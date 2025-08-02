import { ObjectId } from "mongodb";

export interface Rating {
	nifar: number;
	afia: number;
	sijil: number;
	naim: number;
}
export interface ProductDB {
	_id?: ObjectId;
	name: string;
	imageUrls: string[];
	ratings: Rating;
	comment: string;
	createdAt?: Date;
}

export interface ProductAPI {
	_id?: string;
	name: string;
	imageUrls: string[];
	ratings: Rating;
	comment: string;
	createdAt?: Date;
}

export interface User {
	_id?: string;
	username: string;
	name: string;
	role: string;
}

export type Reviewer = keyof Rating;
