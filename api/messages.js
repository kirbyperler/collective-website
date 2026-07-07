const { ObjectId } = require("mongodb");
const connectToDatabase = require("./db");

module.exports = async function handler(req, res) {
  try {
    const db = await connectToDatabase();

    if (req.method === "GET") {
      const messages = await db
        .collection("messages")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json(messages);
    }

    if (req.method === "POST") {
      const message = {
        recipientId: new ObjectId(req.body.recipientId),
        recipientName: req.body.recipientName,
        type: req.body.type,
        text: req.body.text,
        read: false,
        createdAt: new Date()
      };

      const result = await db.collection("messages").insertOne(message);

      await db.collection("players").updateOne(
        { _id: new ObjectId(req.body.recipientId) },
        { $inc: { unreadMessages: 1 } }
      );

      return res.status(201).json({
        message: "Message sent successfully",
        messageId: result.insertedId
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