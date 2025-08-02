import "dotenv/config";
import express, { Express } from "express";
import { VercelRequest, VercelResponse } from "@vercel/node";
import cors from "cors";
import { CorsOptions } from "cors";
import { connectToDB, db } from "./db";
import { ProductDB, User } from "./types";
import { MongoServerError, ObjectId } from "mongodb";

// Setup Express app
const app: Express = express();

const allowedOrigins = [
	"https://bepshapati.vercel.app/",
	"http://localhost:5173",
];

const corsOptions: CorsOptions = {
	origin: (
		origin: string | undefined,
		callback: (err: Error | null, allow?: boolean) => void
	) => {
		if (!origin) return callback(null, true); // Allow non-browser requests or same-origin
		if (allowedOrigins.includes(origin)) {
			return callback(null, true);
		}
		return callback(new Error("Not allowed by CORS"));
	},
	credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

let dbConnected = false;

// Lazy DB connect — runs only once
async function ensureDBConnected() {
	if (!dbConnected) {
		await connectToDB();
		dbConnected = true;
	}
}

// Routes
app.get("/", (_req, res) => {
	res.send("Bepshapati API is running!");
});

// Products API routes
app.get("/api/products", async (_req, res) => {
	try {
		const products = await db.collection("products").find().toArray();
		res.json(products);
	} catch (error: unknown) {
		if (error instanceof Error) {
			res.status(500).json({ error: error.message });
		} else {
			res.status(500).json({ error: "An unknown error occurred" });
		}
	}
});

app.get("/api/products/:id", async (req, res) => {
	try {
		const productIdStr = req.params.id;

		if (!ObjectId.isValid(productIdStr)) {
			return res.status(400).json({ error: "Invalid product ID format" });
		}

		const product = await db
			.collection<ProductDB>("products")
			.findOne({ _id: new ObjectId(productIdStr) });

		if (!product) {
			return res.status(404).json({ error: "Product not found" });
		}

		// Convert ObjectId and Date to string for frontend
		const productResponse = {
			...product,
			_id: product._id?.toString(),
			createdAt: product.createdAt?.toISOString(),
		};

		res.json(productResponse);
	} catch (error: unknown) {
		if (error instanceof Error) {
			res.status(500).json({ error: error.message });
		} else {
			res.status(500).json({ error: "An unknown error occurred" });
		}
	}
});

app.post("/api/products", async (req, res) => {
	try {
		if (!req.body.name || !Array.isArray(req.body.imageUrls)) {
			return res
				.status(400)
				.json({ error: "Missing required fields: name and imageUrls" });
		}

		// Create product object without 'id' field
		const product = {
			name: req.body.name,
			imageUrls: req.body.imageUrls,
			ratings: {
				nifar: req.body.ratings?.nifar || 0,
				afia: req.body.ratings?.afia || 0,
				sijil: req.body.ratings?.sijil || 0,
				naim: req.body.ratings?.naim || 0,
			},
			comment: req.body.comment || "",
			createdAt: new Date(),
		};

		// Insert into MongoDB
		const result = await db.collection("products").insertOne(product);

		res.status(201).json({
			...product,
			_id: result.insertedId.toString(),
		});
	} catch (error) {
		if (error instanceof MongoServerError && error.code === 11000) {
			return res
				.status(409)
				.json({ error: "Product with this ID already exists" });
		}
		if (error instanceof Error) {
			return res.status(500).json({ error: error.message });
		}
		res.status(500).json({ error: "Unknown error occurred" });
	}
});

// Update your PUT endpoint to explicitly handle rating
// Extend express.Request to include user property
app.put("/api/products/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body;

		if (!ObjectId.isValid(id)) {
			return res.status(400).json({ error: "Invalid product ID format" });
		}

		// Allow comment-only updates
		if (updates.comment && !updates.ratings) {
			const updateDoc = {
				$set: {
					comment: updates.comment,
					lastModifiedAt: new Date(),
				},
			};

			const result = await db
				.collection("products")
				.updateOne({ _id: new ObjectId(id) }, updateDoc);

			if (result.matchedCount === 0) {
				return res.status(404).json({ error: "Product not found" });
			}

			return res.json({
				message: "Comment updated successfully",
				product: updateDoc.$set,
			});
		}

		// Existing rating-required logic
		const isUpdatingRatings = Object.keys(updates).some((key) =>
			key.startsWith("ratings.")
		);

		if (!isUpdatingRatings) {
			return res
				.status(400)
				.json({ error: "Rating is required for product updates" });
		}

		updates.lastModifiedAt = new Date();
		const result = await db
			.collection("products")
			.updateOne({ _id: new ObjectId(id) }, { $set: updates });

		if (result.matchedCount === 0) {
			return res.status(404).json({ error: "Product not found" });
		}

		res.json({ message: "Product updated successfully", product: updates });
	} catch (error) {
		console.error("Error updating product:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Users API routes
app.get("/api/users", async (_req, res) => {
	try {
		const users = await db.collection("users").find().toArray();
		res.json(users);
	} catch (error: unknown) {
		if (error instanceof Error) {
			res.status(500).json({ error: error.message });
		} else {
			res.status(500).json({ error: "An unknown error occurred" });
		}
	}
});

// Login route
app.post("/api/login", async (req, res) => {
	try {
		const { username, password } = req.body;
		const user = await db.collection<User>("users").findOne({
			_id: username,
			password,
		});

		if (!user) {
			return res.status(401).json({ error: "Invalid credentials" });
		}

		res.json({
			message: "Login successful",
			user: {
				username: user._id,
				name: user.name,
				role: user.role,
			},
		});
	} catch (error: unknown) {
		if (error instanceof Error) {
			res.status(500).json({ error: error.message });
		} else {
			res.status(500).json({ error: "An unknown error occurred" });
		}
	}
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
	await ensureDBConnected(); // Make sure DB is connected before handling the request
	app(req, res);
}
