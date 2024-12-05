import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();

export const mongoClient = new MongoClient(process.env.MONGODB_URI!);
