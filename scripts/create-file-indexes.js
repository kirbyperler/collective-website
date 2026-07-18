const { getDb } = require("../lib/db");

async function main() {
  const db = await getDb();
  const files = db.collection("playerFiles");

  await files.createIndex({ ownerId: 1, createdAt: -1 });
  await files.createIndex({ uploadedBy: 1, createdAt: -1 });

  // Only made unique if no duplicate pathnames already exist in the collection.
  const duplicates = await files
    .aggregate([
      { $group: { _id: "$pathname", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 }
    ])
    .toArray();

  await files.createIndex({ pathname: 1 }, { unique: duplicates.length === 0 });

  console.log("Indexes created on playerFiles.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Index creation failed:", error.message);
  process.exit(1);
});
