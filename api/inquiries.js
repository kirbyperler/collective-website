const connectToDatabase = require("./db");

module.exports = async function handler(req, res) {
  try {
    const db = await connectToDatabase();

    if (req.method === "POST") {
      const inquiry = {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone || "",
        message: req.body.message,
        status: "New",
        createdAt: new Date()
      };

      const result = await db.collection("inquiries").insertOne(inquiry);

      return res.status(201).json({
        message: "Inquiry submitted successfully",
        inquiryId: result.insertedId
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