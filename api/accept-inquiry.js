const { ObjectId } = require("mongodb");
const { getDb } = require("./db");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      error: `Method ${req.method} not allowed.`
    });
  }

  try {
    const { inquiryId } = req.body || {};

    if (!inquiryId) {
      return res.status(400).json({
        error: "Inquiry ID is required."
      });
    }

    if (!ObjectId.isValid(inquiryId)) {
      return res.status(400).json({
        error: "Invalid inquiry ID."
      });
    }

    const db = await getDb();

    const inquiriesCollection = db.collection("inquiries");
    const usersCollection = db.collection("users");

    const inquiryObjectId = new ObjectId(inquiryId);

    const inquiry = await inquiriesCollection.findOne({
      _id: inquiryObjectId
    });

    if (!inquiry) {
      return res.status(404).json({
        error: "Inquiry not found."
      });
    }

    const role =
      inquiry.role.charAt(0).toUpperCase() +
      inquiry.role.slice(1).toLowerCase();

    const newUser = {
      firstName: inquiry.firstName || "",
      lastName: inquiry.lastName || "",
      email: inquiry.email || "",
      phone: inquiry.phoneNumber || "",
      type: role,
      birthYear: inquiry.birthYear || "",
      position: inquiry.position || "",
      eliteProspects: "",
      files: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const userResult = await usersCollection.insertOne(newUser);

    const deleteResult = await inquiriesCollection.deleteOne({
      _id: inquiryObjectId
    });

    if (deleteResult.deletedCount === 0) {
      // Roll back the new user if deleting the inquiry failed.
      await usersCollection.deleteOne({
        _id: userResult.insertedId
      });

      return res.status(500).json({
        error: "Could not finish accepting the inquiry."
      });
    }

    return res.status(201).json({
      message: "Inquiry accepted and user created.",
      user: {
        ...newUser,
        _id: userResult.insertedId
      }
    });
  } catch (error) {
    console.error("Accept inquiry API error:", error);

    return res.status(500).json({
      error: "Internal server error."
    });
  }
};