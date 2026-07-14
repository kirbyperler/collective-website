const { ObjectId } = require("mongodb");
const { getDb } = require("./db");

module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    const inquiriesCollection = db.collection("inquiries");

    // GET /api/inquiries
    if (req.method === "GET") {
      const inquiries = await inquiriesCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json(inquiries);
    }

    // POST /api/inquiries
    if (req.method === "POST") {
      const {
        firstName,
        lastName,
        role,
        position,
        birthYear,
        phoneNumber,
        email,
        goals
      } = req.body || {};

      if (!firstName || !lastName || !role || !email) {
        return res.status(400).json({
          error: "First name, last name, role, and email are required."
        });
      }

      const newInquiry = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: role.trim().toLowerCase(),
        position: position ? position.trim() : "",
        birthYear: birthYear ? String(birthYear).trim() : "",
        phoneNumber: phoneNumber ? phoneNumber.trim() : "",
        email: email.trim().toLowerCase(),
        goals: goals ? goals.trim() : "",
        createdAt: new Date()
      };

      const result = await inquiriesCollection.insertOne(newInquiry);

      return res.status(201).json({
        message: "Inquiry submitted successfully.",
        inquiry: {
          ...newInquiry,
          _id: result.insertedId
        }
      });
    }

    // DELETE /api/inquiries
    if (req.method === "DELETE") {
      const { id } = req.body || {};

      if (!id) {
        return res.status(400).json({
          error: "Inquiry ID is required."
        });
      }

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          error: "Invalid inquiry ID."
        });
      }

      const result = await inquiriesCollection.deleteOne({
        _id: new ObjectId(id)
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          error: "Inquiry not found."
        });
      }

      return res.status(200).json({
        message: "Inquiry deleted successfully."
      });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);

    return res.status(405).json({
      error: `Method ${req.method} not allowed.`
    });
  } catch (error) {
    console.error("Inquiries API error:", error);

    return res.status(500).json({
      error: "Internal server error."
    });
  }
};