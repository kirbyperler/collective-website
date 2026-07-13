const { MongoClient } = require("mongodb");

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  await client.connect();

  cachedClient = client;
  cachedDb = client.db("collective");

  return cachedDb;
}

module.exports = {
  getDb
};