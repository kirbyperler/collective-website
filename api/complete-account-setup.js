const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getDb } = require("./db");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      error: `Method ${req.method} not allowed.`
    });
  }

  try {
    const {
      token,
      username,
      password
    } = req.body || {};

    if (!token || !username || !password) {
      return res.status(400).json({
        error:
          "Token, username, and password are required."
      });
    }

    const cleanedUsername =
      String(username).trim();

    const usernameLower =
      cleanedUsername.toLowerCase();

    if (
      cleanedUsername.length < 3 ||
      cleanedUsername.length > 30
    ) {
      return res.status(400).json({
        error:
          "Username must be between 3 and 30 characters."
      });
    }

    /*
     * Only allow letters, numbers, periods,
     * underscores, and hyphens.
     */
    const validUsername =
      /^[a-zA-Z0-9._-]+$/;

    if (!validUsername.test(cleanedUsername)) {
      return res.status(400).json({
        error:
          "Username can only contain letters, numbers, periods, underscores, and hyphens."
      });
    }

    if (
      password.length < 10 ||
      password.length > 128
    ) {
      return res.status(400).json({
        error:
          "Password must be between 10 and 128 characters."
      });
    }

    const setupTokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    const db = await getDb();

    const usersCollection =
      db.collection("users");

    /*
     * Find a pending user with this setup token.
     */
    const pendingUser =
      await usersCollection.findOne({
        setupTokenHash,
        accountStatus: "Pending",
        setupTokenExpiresAt: {
          $gt: new Date()
        }
      });

    if (!pendingUser) {
      return res.status(400).json({
        error:
          "This setup link is invalid, expired, or has already been used."
      });
    }

    /*
     * Check whether another user has already selected
     * this username.
     */
    const existingUsername =
      await usersCollection.findOne({
        usernameLower,
        _id: {
          $ne: pendingUser._id
        }
      });

    if (existingUsername) {
      return res.status(409).json({
        error:
          "That username is already taken."
      });
    }

    /*
     * Hash the password before storing it.
     */
    const passwordHash =
      await bcrypt.hash(password, 12);

    /*
     * Activate the account and remove the temporary token.
     */
    const updateResult =
      await usersCollection.updateOne(
        {
          _id: pendingUser._id,
          setupTokenHash,
          accountStatus: "Pending",
          setupTokenExpiresAt: {
            $gt: new Date()
          }
        },
        {
          $set: {
            username: cleanedUsername,
            usernameLower,
            passwordHash,
            accountStatus: "Active",
            accountActivatedAt: new Date(),
            updatedAt: new Date()
          },

          $unset: {
            setupTokenHash: "",
            setupTokenExpiresAt: ""
          }
        }
      );

    if (updateResult.modifiedCount !== 1) {
      return res.status(400).json({
        error:
          "This setup link could not be used. Please request a new invitation."
      });
    }

    return res.status(200).json({
      message:
        "Your Collective account was created successfully."
    });
  } catch (error) {
    console.error(
      "Complete account setup API error:",
      error
    );

    return res.status(500).json({
      error: "Internal server error."
    });
  }
};