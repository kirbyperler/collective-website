const { MongoClient } = require("mongodb");

let client;

async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  }

  return client.db("collective");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST requests allowed" });
  }

  try {
    const db = await connectToDatabase();

    const newUser = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      name: `${req.body.firstName} ${req.body.lastName}`,
      email: req.body.email,
      role: req.body.role,
      position: req.body.position,
      birthYear: req.body.birthYear,
      team: "Unassigned",
      status: "New",
      createdAt: new Date()
    };

    const result = await db.collection("players").insertOne(newUser);

    return res.status(201).json({
      message: "User created",
      userId: result.insertedId
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};