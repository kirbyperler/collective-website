const { MongoClient, ObjectId } = require("mongodb");

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI or MONGODB_URI is missing.");

let clientPromise = global._collectiveMongoClientPromise;
if (!clientPromise) {
  clientPromise = new MongoClient(uri).connect();
  global._collectiveMongoClientPromise = clientPromise;
}

async function getDb() {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "collective");
}

function toObjectId(value) {
  return value && ObjectId.isValid(String(value)) ? new ObjectId(String(value)) : null;
}

function serialize(document) {
  if (!document) return document;
  const result = { ...document };
  if (result._id) {
    result._id = String(result._id);
    result.id = result._id;
  }
  if (result.userId instanceof ObjectId) result.userId = String(result.userId);
  if (result.playerId instanceof ObjectId) result.playerId = String(result.playerId);
  if (result.senderId instanceof ObjectId) result.senderId = String(result.senderId);
  if (result.recipientId instanceof ObjectId) result.recipientId = String(result.recipientId);
  return result;
}

async function getAvatarMap(db, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(String))]
    .map(toObjectId)
    .filter(Boolean);
  if (!uniqueIds.length) return new Map();
  const users = await db.collection("users")
    .find({ _id: { $in: uniqueIds } })
    .project({ avatarUrl: 1, firstName: 1, lastName: 1, type: 1 })
    .toArray();
  const map = new Map();
  for (const user of users) {
    map.set(String(user._id), {
      avatarUrl: user.avatarUrl || "",
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      role: user.type || ""
    });
  }
  return map;
}

module.exports = { getDb, toObjectId, serialize, getAvatarMap };
