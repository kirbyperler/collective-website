const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const { Resend } = require("resend");
const { getDb } = require("./db");

const resend = new Resend(process.env.RESEND_API_KEY);

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

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        error: "The email service is not configured."
      });
    }

    if (!process.env.SITE_URL) {
      return res.status(500).json({
        error: "SITE_URL is not configured."
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

    if (!inquiry.email) {
      return res.status(400).json({
        error: "This inquiry does not have an email address."
      });
    }

    const role =
      inquiry.role.charAt(0).toUpperCase() +
      inquiry.role.slice(1).toLowerCase();

    /*
     * This is the secret token placed in the emailed link.
     */
    const setupToken = crypto
      .randomBytes(32)
      .toString("hex");

    /*
     * Only the hashed token is saved in MongoDB.
     */
    const setupTokenHash = crypto
      .createHash("sha256")
      .update(setupToken)
      .digest("hex");

    /*
     * The setup link expires after 24 hours.
     */
    const setupTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    const newUser = {
      firstName: inquiry.firstName || "",
      lastName: inquiry.lastName || "",
      email: inquiry.email.trim().toLowerCase(),
      phone: inquiry.phoneNumber || "",
      type: role,
      birthYear: inquiry.birthYear || "",
      position: inquiry.position || "",
      eliteProspects: "",
      files: [],

      username: null,
      usernameLower: null,
      passwordHash: null,
      accountStatus: "Pending",

      setupTokenHash,
      setupTokenExpiresAt,

      createdAt: new Date(),
      updatedAt: new Date()
    };

    /*
     * Prevent the same email address from being accepted twice.
     */
    const existingUser = await usersCollection.findOne({
      email: newUser.email
    });

    if (existingUser) {
      return res.status(409).json({
        error: "A user with this email address already exists."
      });
    }

    const userResult = await usersCollection.insertOne(newUser);

    const siteUrl = process.env.SITE_URL.replace(/\/$/, "");

    const setupUrl =
      `${siteUrl}/setup-account.html?token=` +
      encodeURIComponent(setupToken);

    const firstName = escapeHtml(newUser.firstName);
    const safeSetupUrl = escapeHtml(setupUrl);

    /*
     * Send the account invitation before deleting the inquiry.
     */
    const { data: emailData, error: emailError } =
      await resend.emails.send({
        from: "Collective <onboarding@resend.dev>",
        to: [newUser.email],
        subject: "Set up your Collective account",
        html: `
          <div style="
            background-color: #111111;
            color: #f1eedf;
            font-family: Arial, Helvetica, sans-serif;
            padding: 40px 20px;
          ">
            <div style="
              max-width: 560px;
              margin: 0 auto;
              background-color: #1b1b1b;
              border: 1px solid #333333;
              border-radius: 12px;
              padding: 32px;
            ">
              <h1 style="
                margin: 0 0 20px;
                font-size: 28px;
              ">
                Welcome to Collective
              </h1>

              <p style="
                font-size: 16px;
                line-height: 1.6;
              ">
                Hi ${firstName},
              </p>

              <p style="
                font-size: 16px;
                line-height: 1.6;
              ">
                Your inquiry has been accepted. Use the button
                below to create your username and password.
              </p>

              <a
                href="${safeSetupUrl}"
                style="
                  display: inline-block;
                  margin: 20px 0;
                  padding: 14px 22px;
                  background-color: #d62f2a;
                  color: #ffffff;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: bold;
                "
              >
                Create Your Account
              </a>

              <p style="
                color: #b8b8b8;
                font-size: 14px;
                line-height: 1.5;
              ">
                This setup link expires in 24 hours and can only
                be used once.
              </p>

              <p style="
                color: #777777;
                font-size: 12px;
                word-break: break-all;
              ">
                ${safeSetupUrl}
              </p>
            </div>
          </div>
        `,
        text:
          `Welcome to Collective, ${newUser.firstName}.\n\n` +
          `Your inquiry has been accepted. Create your username ` +
          `and password using this link:\n\n${setupUrl}\n\n` +
          `This link expires in 24 hours.`
      });

    if (emailError) {
      /*
       * Remove the new user if the invitation email failed.
       */
      await usersCollection.deleteOne({
        _id: userResult.insertedId
      });

      console.error("Resend email error:", emailError);

      return res.status(502).json({
        error:
          emailError.message ||
          "The account invitation email could not be sent."
      });
    }

    const deleteResult = await inquiriesCollection.deleteOne({
      _id: inquiryObjectId
    });

    if (deleteResult.deletedCount === 0) {
      /*
       * The user was already emailed, so we do not delete the user
       * here. Doing so would make the emailed link unusable.
       */
      console.error(
        "User created and emailed, but inquiry deletion failed:",
        inquiryId
      );

      return res.status(500).json({
        error:
          "The user was created and emailed, but the inquiry " +
          "could not be removed. Refresh the dashboard."
      });
    }

    return res.status(201).json({
      message:
        "Inquiry accepted and account setup email sent.",
      emailId: emailData ? emailData.id : null,
      user: {
        ...newUser,
        setupTokenHash: undefined,
        setupTokenExpiresAt: undefined,
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}