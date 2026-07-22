const crypto = require("crypto");
const { Resend } = require("resend");

const SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function buildSetupUrl(token) {
  if (!process.env.SITE_URL) throw new Error("SITE_URL is missing.");
  return `${process.env.SITE_URL.replace(/\/$/, "")}/setup-account.html?token=${encodeURIComponent(token)}`;
}

// Generates a fresh setup token, sends the account setup email, and persists
// the hashed token. Reused by inquiry acceptance, admin-triggered sends, and
// resends -- overwriting setupTokenHash/setupTokenExpiresAt here is what
// invalidates any previously issued token.
async function sendAccountSetupEmail(db, user) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is missing.");
  if (!user?.email) return { success: false, error: "This user does not have a valid email address." };

  const setupToken = crypto.randomBytes(32).toString("hex");
  const setupTokenHash = crypto.createHash("sha256").update(setupToken).digest("hex");
  const setupTokenExpiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);
  const setupUrl = buildSetupUrl(setupToken);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "Collective <onboarding@resend.dev>",
    to: [user.email],
    subject: "Set up your Collective account",
    html: `<p>Hi ${user.firstName || ""},</p><p>Set up your Collective account to get started.</p><p><a href="${setupUrl}">Create your account</a></p>`,
    text: `Create your Collective account: ${setupUrl}`
  });
  if (error) return { success: false, error: error.message || "Invitation email failed." };

  const setupEmailSentAt = new Date();
  await db.collection("users").updateOne({ _id: user._id }, {
    $set: {
      setupTokenHash, setupTokenExpiresAt, setupEmailSentAt,
      accountStatus: user.accountStatus === "Active" ? user.accountStatus : "Pending",
      updatedAt: setupEmailSentAt
    }
  });

  return { success: true, setupEmailSentAt, setupTokenExpiresAt };
}

// Derives a human-readable setup/account status from persisted fields
// without requiring a dedicated status field to be kept in sync everywhere.
function computeSetupStatus(user) {
  if (user?.accountStatus === "Active" || user?.setupCompletedAt) return "Active";
  if (user?.setupTokenHash && user?.setupTokenExpiresAt) {
    return new Date(user.setupTokenExpiresAt) > new Date() ? "Invite Sent" : "Invite Expired";
  }
  return "Pending Setup";
}

module.exports = { SETUP_TOKEN_TTL_MS, buildSetupUrl, sendAccountSetupEmail, computeSetupStatus };
