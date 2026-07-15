import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not configured.");
}

let clientPromise = globalThis.__collectiveMongoClientPromise;

if (!clientPromise) {
  const client = new MongoClient(uri);
  clientPromise = client.connect();
  globalThis.__collectiveMongoClientPromise = clientPromise;
}

export async function getDatabase() {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || undefined);
}

export function toObjectId(value) {
  if (!value || !ObjectId.isValid(String(value))) {
    return null;
  }
  return new ObjectId(String(value));
}

export function serializeDocument(document) {
  if (!document) return document;
  return {
    ...document,
    _id: String(document._id),
    id: String(document._id)
  };
}
