const { ObjectId } = require("mongodb");
const { getDb } = require("./db");

module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    const filesCollection = db.collection("files");
    const usersCollection = db.collection("users");

    // GET /api/files
    if (req.method === "GET") {
      const files = await filesCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json(files);
    }

    // POST /api/files
    if (req.method === "POST") {
      const {
        userId,
        fileName,
        fileUrl,
        category
      } = req.body || {};

      if (!userId || !fileName || !fileUrl) {
        return res.status(400).json({
          error: "User ID, file name, and file URL are required."
        });
      }

      if (!ObjectId.isValid(userId)) {
        return res.status(400).json({
          error: "Invalid user ID."
        });
      }

      const user = await usersCollection.findOne({
        _id: new ObjectId(userId)
      });

      if (!user) {
        return res.status(404).json({
          error: "User not found."
        });
      }

      const newFile = {
        userId: new ObjectId(userId),
        assignedTo: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        fileName: fileName.trim(),
        fileUrl: fileUrl.trim(),
        category: category ? category.trim() : "General",
        createdAt: new Date()
      };

      const result = await filesCollection.insertOne(newFile);

      return res.status(201).json({
        message: "File saved successfully.",
        file: {
          ...newFile,
          _id: result.insertedId
        }
      });
    }

    // DELETE /api/files
    if (req.method === "DELETE") {
      const { id } = req.body || {};

      if (!id) {
        return res.status(400).json({
          error: "File ID is required."
        });
      }

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          error: "Invalid file ID."
        });
      }

      const result = await filesCollection.deleteOne({
        _id: new ObjectId(id)
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          error: "File not found."
        });
      }

      return res.status(200).json({
        message: "File deleted successfully."
      });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);

    return res.status(405).json({
      error: `Method ${req.method} not allowed.`
    });
  } catch (error) {
    console.error("Files API error:", error);

    return res.status(500).json({
      error: "Internal server error."
    });
  }
};