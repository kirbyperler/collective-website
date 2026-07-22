const { getDb } = require("../lib/db");

// One-off migration: renames the legacy usernameLower field to usernameNormalized
// so existing users match the field api/auth.js now queries on login.
async function main() {
  const db = await getDb();
  const users = db.collection("users");

  const legacy = await users.find({ usernameLower: { $exists: true } }).toArray();
  console.log(`Found ${legacy.length} user(s) with usernameLower.`);

  for (const user of legacy) {
    await users.updateOne(
      { _id: user._id },
      { $set: { usernameNormalized: user.usernameLower }, $unset: { usernameLower: "" } }
    );
    console.log(`Migrated ${user._id}: usernameLower="${user.usernameLower}" -> usernameNormalized`);
  }

  console.log("Migration complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
