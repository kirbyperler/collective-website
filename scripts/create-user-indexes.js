const { getDb } = require("../lib/db");

async function main() {
  const db = await getDb();
  const users = db.collection("users");

  // Only made unique if no duplicate usernames already exist in the collection.
  // Partial (not sparse) so the many users without a username yet (null/missing) never collide.
  const duplicates = await users
    .aggregate([
      { $match: { usernameNormalized: { $type: "string" } } },
      { $group: { _id: "$usernameNormalized", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 }
    ])
    .toArray();

  await users.createIndex(
    { usernameNormalized: 1 },
    { unique: duplicates.length === 0, partialFilterExpression: { usernameNormalized: { $type: "string" } } }
  );

  console.log("Indexes created on users.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Index creation failed:", error.message);
  process.exit(1);
});
