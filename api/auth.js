const { createHmac, scryptSync, timingSafeEqual, createHash } = require("crypto");
const bcrypt = require("bcryptjs");
const { getDb } = require("../lib/db");
const { action, allowMethods, cleanText } = require("../lib/http");
const { getSession } = require("../lib/auth");

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return ({ admin: "Admin", player: "Player", coach: "Coach", advisor: "Advisor" })[value] || null;
}

function redirectFor(role) {
  return ({ Admin: "/admin", Player: "/dashboard", Coach: "/coach", Advisor: "/advisor" })[role] || null;
}

function verifyScrypt(password, stored) {
  if (!password || !stored || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  const attempted = scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, "hex");
  return attempted.length === expected.length && timingSafeEqual(attempted, expected);
}

function createToken(payload) {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is missing.");
  const data = { ...payload, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function setSessionCookie(res, token) {
  const parts = [
    `collective_session=${token}`,
    "Path=/",
    `Max-Age=${8 * 60 * 60}`,
    "HttpOnly",
    "SameSite=Strict"
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

async function login(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;
  const username = cleanText(req.body?.username, 100).toLowerCase();
  const password = String(req.body?.password || "");
  if (!username || !password) return res.status(400).json({ message: "Username and password are required." });

  let role = null;
  let userId = null;
  let valid = false;
  const adminUsername = cleanText(process.env.ADMIN_USERNAME, 100).toLowerCase();

  if (adminUsername && username === adminUsername) {
    role = "Admin";
    valid = verifyScrypt(password, process.env.ADMIN_PASSWORD_HASH || "");
  } else {
    const db = await getDb();
    const user = await db.collection("users").findOne({ usernameLower: username });
    if (user) {
      if (user.accountStatus !== "Active") return res.status(403).json({ message: "This account has not been activated." });
      role = normalizeRole(user.type);
      userId = String(user._id);
      valid = await bcrypt.compare(password, user.passwordHash || "").catch(() => false);
    }
  }

  if (!role || !valid) return res.status(401).json({ message: "Invalid username or password." });
  const redirectTo = redirectFor(role);
  if (!redirectTo) return res.status(403).json({ message: "This account does not have an assigned dashboard." });
  setSessionCookie(res, createToken({ userId, role }));
  return res.status(200).json({ message: "Login successful.", redirectTo });
}

async function logout(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;
  const parts = ["collective_session=", "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Strict"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
  return res.status(200).json({ message: "Logged out successfully." });
}

async function completeSetup(req, res) {
  if (!allowMethods(req, res, ["POST"])) return;
  const token = String(req.body?.token || "");
  const username = cleanText(req.body?.username, 30);
  const password = String(req.body?.password || "");
  if (!token || !username || !password) return res.status(400).json({ error: "Token, username, and password are required." });
  if (username.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(username)) return res.status(400).json({ error: "Username must be 3-30 characters and use only letters, numbers, periods, underscores, or hyphens." });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ error: "Password must be between 10 and 128 characters." });

  const db = await getDb();
  const users = db.collection("users");
  const setupTokenHash = createHash("sha256").update(token).digest("hex");
  const pending = await users.findOne({ setupTokenHash, accountStatus: "Pending", setupTokenExpiresAt: { $gt: new Date() } });
  if (!pending) return res.status(400).json({ error: "This setup link is invalid, expired, or already used." });
  const usernameLower = username.toLowerCase();
  const duplicate = await users.findOne({ usernameLower, _id: { $ne: pending._id } });
  if (duplicate) return res.status(409).json({ error: "That username is already taken." });
  const passwordHash = await bcrypt.hash(password, 12);
  await users.updateOne({ _id: pending._id }, {
    $set: { username, usernameLower, passwordHash, accountStatus: "Active", accountActivatedAt: new Date(), updatedAt: new Date() },
    $unset: { setupTokenHash: "", setupTokenExpiresAt: "" }
  });
  return res.status(200).json({ message: "Your Collective account was created successfully." });
}

module.exports = async function handler(req, res) {
  try {
    const route = action(req);
    if (route === "login") return login(req, res);
    if (route === "logout") return logout(req, res);
    if (route === "complete-account-setup") return completeSetup(req, res);
    if (route === "session") {
      if (!allowMethods(req, res, ["GET"])) return;
      const session = getSession(req);
      return session ? res.status(200).json({ session }) : res.status(401).json({ error: "No active session." });
    }
    return res.status(404).json({ error: "Authentication action not found." });
  } catch (error) {
    console.error("Auth API error:", error);
    return res.status(500).json({ error: "Authentication request failed." });
  }
};
