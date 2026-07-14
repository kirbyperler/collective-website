const { ObjectId } = require("mongodb");
const { getDb } = require("./db");

module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    const playerId = req.query.id;

    if (!playerId) {
      return res.status(400).json({ message: "Missing player ID" });
    }

    if (req.method === "GET") {
      const player = await db.collection("players").findOne({
        _id: new ObjectId(playerId)
      });

      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      return res.status(200).json(player);
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};