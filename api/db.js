const { MongoClient } = require("mongodb");

let client;
let database;

async function connectToDatabase() {
  if (database) {
    return database;
  }

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  database = client.db("collective");

  return database;
}

module.exports = connectToDatabase;