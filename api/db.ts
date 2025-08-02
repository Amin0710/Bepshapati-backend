import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
let client: MongoClient;
let db: Db;

export async function connectToDB() {
	try {
		client = new MongoClient(uri);
		await client.connect();
		db = client.db("bepshapati");

		// Add these verification logs:
		console.log("Connected to DB:", db.databaseName);
		const collections = await db.listCollections().toArray();
		console.log(
			"Collections:",
			collections.map((c) => c.name)
		);
	} catch (error) {
		console.error("Connection failed:", error);
		process.exit(1);
	}
}

export { db, client };
