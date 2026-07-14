const { ObjectId } = require("mongodb");
const { getDb } = require("./db");

module.exports = async function handler(req, res) {
  try {
    const db = await getDb();
    const users = db.collection("users");

    if (req.method === "GET") {
      const search = req.query.search || "";
      const type = req.query.type || "";

      const filter = {};

      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ];
      }

      if (type) {
        filter.type = type;
      }

      const results = await users
        .find(filter)
        .sort({ lastName: 1 })
        .toArray();

      return res.status(200).json(results);
    }

    if (req.method === "POST") {
      const {
        firstName,
        lastName,
        type,
        birthYear,
        position,
        email,
        phone,
        eliteProspects
      } = req.body || {};

      if (!firstName || !lastName || !type || !email) {
        return res.status(400).json({
          error: "First name, last name, type, and email are required."
        });
      }

      const existingUser = await users.findOne({
        email: email.toLowerCase().trim()
      });

      if (existingUser) {
        return res.status(409).json({
          error: "A user with this email already exists."
        });
      }

      const newUser = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        type,
        birthYear: birthYear || "",
        position: position || "",
        email: email.toLowerCase().trim(),
        phone: phone || "",
        eliteProspects: eliteProspects || "",
        files: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await users.insertOne(newUser);

      return res.status(201).json({
        success: true,
        user: {
          ...newUser,
          _id: result.insertedId
        }
      });
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);

    if (req.method === "PATCH") {
  const {
    id,
    firstName,
    lastName,
    type,
    birthYear,
    position,
    email,
    phone
  } = req.body || {};

  if (!id) {
    return res.status(400).json({
      error: "User ID is required."
    });
  }

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      error: "Invalid user ID."
    });
  }

  if (eliteProspects !== undefined) {
  updates.eliteProspects = eliteProspects;
  }

  const updates = {
    updatedAt: new Date()
  };

  if (firstName !== undefined) updates.firstName = firstName.trim();
  if (lastName !== undefined) updates.lastName = lastName.trim();
  if (type !== undefined) updates.type = type;
  if (birthYear !== undefined) updates.birthYear = birthYear;
  if (position !== undefined) updates.position = position;
  if (email !== undefined) updates.email = email.toLowerCase().trim();
  if (phone !== undefined) updates.phone = phone;

  const result = await users.findOneAndUpdate(
    {
      _id: new ObjectId(id)
    },
    {
      $set: updates
    },
    {
      returnDocument: "after"
    }
  );

  if (!result) {
    return res.status(404).json({
      error: "User not found."
    });
  }

  return res.status(200).json({
    success: true,
    user: result
  });
}

if (req.method === "DELETE") {
  const { id } = req.body || {};

  if (!id) {
    return res.status(400).json({
      error: "User ID is required."
    });
  }

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      error: "Invalid user ID."
    });
  }

  const result = await users.deleteOne({
    _id: new ObjectId(id)
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({
      error: "User not found."
    });
  }

  return res.status(200).json({
    success: true,
    message: "User deleted successfully."
  });
}

    return res.status(405).json({
      error: `Method ${req.method} is not allowed.`
    });
  } catch (error) {
    console.error("Users API error:", error);

    return res.status(500).json({
      error: "Failed to access users.",
      details: error.message
    });
  }
};