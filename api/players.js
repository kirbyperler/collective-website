const connectToDatabase = require("./db");

module.exports = async function handler(req, res) {
  try {
    const db = await connectToDatabase();

    if (req.method === "GET") {
      const players = await db
        .collection("players")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json(players);
    }

    if (req.method === "POST") {
      const newPlayer = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        name: `${req.body.firstName} ${req.body.lastName}`,
        email: req.body.email,
        role: req.body.role || "Player",
        position: req.body.position || "Unassigned",
        birthYear: req.body.birthYear || "N/A",
        team: "Unassigned",
        status: "New",
        advisor: "Unassigned",
        videoCoach: "Unassigned",
        tasksDue: 0,
        unreadMessages: 0,
        createdAt: new Date()
      };

      const result = await db.collection("players").insertOne(newPlayer);

      return res.status(201).json({
        message: "Player created successfully",
        playerId: result.insertedId
      });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};