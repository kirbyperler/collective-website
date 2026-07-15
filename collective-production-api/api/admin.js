const crypto = require("crypto");
const { Resend } = require("resend");
const { getDb, toObjectId, serialize } = require("../lib/db");
const { requireAdmin, requireStaff } = require("../lib/auth");
const { action, allowMethods, cleanText } = require("../lib/http");

async function usersRoute(req, res, db) {
  if (!allowMethods(req, res, ["GET", "POST", "PATCH", "DELETE"])) return;
  const users = db.collection("users");
  if (req.method === "GET") {
    const filter = {};
    const search = cleanText(req.query?.search, 100);
    const type = cleanText(req.query?.type, 30);
    if (search) filter.$or = ["firstName", "lastName", "email"].map(field => ({ [field]: { $regex: search, $options: "i" } }));
    if (type) filter.type = type;
    return res.status(200).json((await users.find(filter).sort({ lastName: 1 }).toArray()).map(serialize));
  }
  if (req.method === "POST") {
    const body = req.body || {};
    const email = cleanText(body.email, 200).toLowerCase();
    if (!body.firstName || !body.lastName || !body.type || !email) return res.status(400).json({ error: "First name, last name, type, and email are required." });
    if (await users.findOne({ email })) return res.status(409).json({ error: "A user with this email already exists." });
    const document = {
      firstName: cleanText(body.firstName, 100), lastName: cleanText(body.lastName, 100), type: cleanText(body.type, 30),
      birthYear: cleanText(body.birthYear, 10), position: cleanText(body.position, 50), email,
      phone: cleanText(body.phone, 50), eliteProspects: cleanText(body.eliteProspects, 1000), files: [],
      careerStatus: cleanText(body.careerStatus, 30) || "Youth", createdAt: new Date(), updatedAt: new Date()
    };
    const result = await users.insertOne(document);
    return res.status(201).json({ success: true, user: serialize({ ...document, _id: result.insertedId }) });
  }
  const id = toObjectId(req.body?.id);
  if (!id) return res.status(400).json({ error: "A valid user ID is required." });
  if (req.method === "PATCH") {
    const body = req.body || {};
    const updates = {};
    for (const field of ["firstName","lastName","email","phone","type","birthYear","position","eliteProspects","careerStatus"]) {
      if (Object.prototype.hasOwnProperty.call(body, field)) updates[field] = cleanText(body[field], field === "eliteProspects" ? 1000 : 200);
    }
    if (updates.email) updates.email = updates.email.toLowerCase();
    updates.updatedAt = new Date();
    const result = await users.findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: "after" });
    const user = result?.value || result;
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.status(200).json({ message: "User updated successfully.", user: serialize(user) });
  }
  const result = await users.deleteOne({ _id: id });
  return result.deletedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "User not found." });
}

async function messagesRoute(req, res, db) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;
  const messages = db.collection("messages");
  const users = db.collection("users");
  if (req.method === "GET") return res.status(200).json((await messages.find({}).sort({ createdAt: -1 }).toArray()).map(serialize));
  if (req.method === "POST") {
    const userId = toObjectId(req.body?.userId || req.body?.recipientId);
    const text = cleanText(req.body?.text, 4000);
    if (!userId || !text) return res.status(400).json({ error: "User and message text are required." });
    const user = await users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found." });
    const toName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    const document = { userId, recipientId: userId, to: toName, toName, senderName: "Collective Admin", fromName: "Collective Admin", type: cleanText(req.body?.type, 100) || "Admin Notice", subject: cleanText(req.body?.subject, 150), text, read: false, deletedFor: [], createdAt: new Date() };
    const result = await messages.insertOne(document);
    return res.status(201).json({ message: "Message created successfully.", savedMessage: serialize({ ...document, _id: result.insertedId }) });
  }
  const id = toObjectId(req.body?.id);
  if (!id) return res.status(400).json({ error: "Valid message ID is required." });
  const result = await messages.deleteOne({ _id: id });
  return result.deletedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "Message not found." });
}

async function progressRoute(req, res, db, session) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;
  const collection = db.collection("playerProgress");
  const playerId = toObjectId(req.method === "GET" ? req.query?.playerId : req.body?.playerId);
  if (req.method === "GET") {
    if (!playerId) return res.status(400).json({ error: "Valid playerId is required." });
    return res.status(200).json({ ratings: (await collection.find({ playerId }).sort({ createdAt: -1 }).toArray()).map(serialize) });
  }
  if (req.method === "POST") {
    const rating = Number(req.body?.rating);
    const category = cleanText(req.body?.category, 100);
    if (!playerId || !category || !Number.isFinite(rating) || rating < 0 || rating > 100) return res.status(400).json({ error: "playerId, category, and a 0-100 rating are required." });
    const document = { playerId, category, rating, note: cleanText(req.body?.note, 1000), evaluator: session.role, evaluatorId: toObjectId(session.userId), evaluatorRole: session.role, createdAt: new Date() };
    const result = await collection.insertOne(document);
    return res.status(201).json({ rating: serialize({ ...document, _id: result.insertedId }) });
  }
  const id = toObjectId(req.body?.id);
  if (!id) return res.status(400).json({ error: "Valid rating ID is required." });
  const result = await collection.deleteOne({ _id: id });
  return result.deletedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "Rating not found." });
}

async function acceptInquiry(req, res, db) {
  if (!allowMethods(req, res, ["POST"])) return;
  const inquiryId = toObjectId(req.body?.inquiryId);
  if (!inquiryId) return res.status(400).json({ error: "Valid inquiry ID is required." });
  if (!process.env.RESEND_API_KEY || !process.env.SITE_URL) return res.status(500).json({ error: "RESEND_API_KEY and SITE_URL are required." });
  const inquiries = db.collection("inquiries");
  const users = db.collection("users");
  const inquiry = await inquiries.findOne({ _id: inquiryId });
  if (!inquiry) return res.status(404).json({ error: "Inquiry not found." });
  const email = cleanText(inquiry.email, 200).toLowerCase();
  if (await users.findOne({ email })) return res.status(409).json({ error: "A user with this email already exists." });
  const setupToken = crypto.randomBytes(32).toString("hex");
  const document = {
    firstName: inquiry.firstName || "", lastName: inquiry.lastName || "", email, phone: inquiry.phoneNumber || "",
    type: `${String(inquiry.role || "player").charAt(0).toUpperCase()}${String(inquiry.role || "player").slice(1).toLowerCase()}`,
    birthYear: inquiry.birthYear || "", position: inquiry.position || "", eliteProspects: "", files: [], careerStatus: "Youth",
    username: null, usernameLower: null, passwordHash: null, accountStatus: "Pending",
    setupTokenHash: crypto.createHash("sha256").update(setupToken).digest("hex"),
    setupTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), createdAt: new Date(), updatedAt: new Date()
  };
  const inserted = await users.insertOne(document);
  const setupUrl = `${process.env.SITE_URL.replace(/\/$/, "")}/setup-account.html?token=${encodeURIComponent(setupToken)}`;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: "Collective <onboarding@resend.dev>", to: [email], subject: "Set up your Collective account", html: `<p>Hi ${document.firstName},</p><p>Your inquiry was accepted.</p><p><a href="${setupUrl}">Create your account</a></p>`, text: `Create your Collective account: ${setupUrl}` });
  if (error) { await users.deleteOne({ _id: inserted.insertedId }); return res.status(502).json({ error: error.message || "Invitation email failed." }); }
  await inquiries.deleteOne({ _id: inquiryId });
  return res.status(201).json({ message: "Inquiry accepted and setup email sent.", user: serialize({ ...document, _id: inserted.insertedId }) });
}

module.exports = async function handler(req, res) {
  try {
    const route = action(req);
    const session = route === "progress" ? requireStaff(req, res) : requireAdmin(req, res);
    if (!session) return;
    const db = await getDb();
    if (route === "users") return usersRoute(req, res, db);
    if (route === "messages") return messagesRoute(req, res, db);
    if (route === "progress") return progressRoute(req, res, db, session);
    if (route === "accept-inquiry") return acceptInquiry(req, res, db);
    return res.status(404).json({ error: "Admin action not found." });
  } catch (error) {
    console.error("Admin API error:", error);
    return res.status(500).json({ error: "Admin request failed.", details: error.message });
  }
};
