const crypto = require("crypto");
const { Resend } = require("resend");
const { getDb, toObjectId, serialize, getAvatarMap } = require("../lib/db");
const { requireAdmin, requireStaff } = require("../lib/auth");
const { action, allowMethods, cleanText, escapeRegex } = require("../lib/http");
const { fetchEliteProspectsData, isValidEliteProspectsUrl } = require("../lib/eliteProspects");

const USER_TYPES = ["Player", "Coach", "Advisor"];
const CAREER_STATUSES = ["Youth", "Prep", "Juniors", "College", "Pro"];

async function usersRoute(req, res, db) {
  if (!allowMethods(req, res, ["GET", "POST", "PATCH", "DELETE"])) return;
  const users = db.collection("users");
  if (req.method === "GET") {
    const filter = {};
    const search = cleanText(req.query?.search, 100);
    const type = cleanText(req.query?.type, 30);
    if (search) {
      const pattern = escapeRegex(search);
      filter.$or = ["firstName", "lastName", "email"].map(field => ({ [field]: { $regex: pattern, $options: "i" } }));
    }
    if (type) filter.type = type;
    return res.status(200).json((await users.find(filter).sort({ lastName: 1 }).toArray()).map(serialize));
  }
  if (req.method === "POST") {
    const body = req.body || {};
    const email = cleanText(body.email, 200).toLowerCase();
    const type = cleanText(body.type, 30);
    if (!body.firstName || !body.lastName || !type || !email) return res.status(400).json({ error: "First name, last name, type, and email are required." });
    if (!USER_TYPES.includes(type)) return res.status(400).json({ error: "Type must be Player, Coach, or Advisor." });
    const careerStatus = cleanText(body.careerStatus, 30) || "Youth";
    if (!CAREER_STATUSES.includes(careerStatus)) return res.status(400).json({ error: "Invalid career status." });
    if (await users.findOne({ email })) return res.status(409).json({ error: "A user with this email already exists." });
    const document = {
      firstName: cleanText(body.firstName, 100), lastName: cleanText(body.lastName, 100), type,
      birthYear: cleanText(body.birthYear, 10), position: cleanText(body.position, 50), email,
      phone: cleanText(body.phone, 50), eliteProspects: cleanText(body.eliteProspects, 1000), files: [],
      careerStatus, createdAt: new Date(), updatedAt: new Date()
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
    if (updates.type && !USER_TYPES.includes(updates.type)) return res.status(400).json({ error: "Type must be Player, Coach, or Advisor." });
    if (updates.careerStatus && !CAREER_STATUSES.includes(updates.careerStatus)) return res.status(400).json({ error: "Invalid career status." });
    updates.updatedAt = new Date();
    const result = await users.findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: "after" });
    const user = result?.value || result;
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.status(200).json({ message: "User updated successfully.", user: serialize(user) });
  }
  const result = await users.deleteOne({ _id: id });
  return result.deletedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "User not found." });
}

async function messagesRoute(req, res, db, session) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;
  const messages = db.collection("messages");
  const users = db.collection("users");
  if (req.method === "GET") {
    const records = await messages.find({}).sort({ createdAt: -1 }).toArray();
    const avatarMap = await getAvatarMap(db, records.map(record => record.userId));
    return res.status(200).json(records.map(record => ({
      ...serialize(record),
      avatarUrl: avatarMap.get(String(record.userId))?.avatarUrl || ""
    })));
  }
  if (req.method === "POST") {
    const userId = toObjectId(req.body?.userId || req.body?.recipientId);
    const text = cleanText(req.body?.text, 4000);
    if (!userId || !text) return res.status(400).json({ error: "User and message text are required." });
    const user = await users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: "User not found." });
    const toName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    const document = { userId, recipientId: userId, senderId: toObjectId(session.userId), to: toName, toName, senderName: "Collective Admin", fromName: "Collective Admin", type: cleanText(req.body?.type, 100) || "Admin Notice", subject: cleanText(req.body?.subject, 150), text, read: false, deletedFor: [], createdAt: new Date() };
    const result = await messages.insertOne(document);
    return res.status(201).json({ message: "Message created successfully.", savedMessage: serialize({ ...document, _id: result.insertedId }) });
  }
  const id = toObjectId(req.body?.id);
  if (!id) return res.status(400).json({ error: "Valid message ID is required." });
  const result = await messages.deleteOne({ _id: id });
  return result.deletedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "Message not found." });
}

const DEFAULT_PROGRESS_CATEGORIES = ["Skating", "Edge Work", "Hockey IQ", "Shooting", "Puck Skills"];

async function ensureDefaultCategories(categories) {
  const count = await categories.countDocuments({});
  if (count > 0) return;
  const now = new Date();
  await categories.insertMany(DEFAULT_PROGRESS_CATEGORIES.map((name, index) => ({ name, order: index, createdAt: now, updatedAt: now })));
}

async function progressCategoriesRoute(req, res, db) {
  const categories = db.collection("progressCategories");

  if (req.method === "GET") {
    await ensureDefaultCategories(categories);
    const list = await categories.find({}).sort({ order: 1, createdAt: 1 }).toArray();
    return res.status(200).json({ categories: list.map(serialize) });
  }

  if (req.method === "POST") {
    const name = cleanText(req.body?.name, 100);
    if (!name) return res.status(400).json({ error: "A category name is required." });
    const highest = await categories.find({}).sort({ order: -1 }).limit(1).toArray();
    const order = highest.length ? highest[0].order + 1 : 0;
    const now = new Date();
    const document = { name, order, createdAt: now, updatedAt: now };
    const result = await categories.insertOne(document);
    return res.status(201).json({ category: serialize({ ...document, _id: result.insertedId }) });
  }

  const id = toObjectId(req.body?.id);
  if (!id) return res.status(400).json({ error: "A valid category ID is required." });

  if (req.method === "PATCH") {
    const existing = await categories.findOne({ _id: id });
    if (!existing) return res.status(404).json({ error: "Category not found." });

    const updates = { updatedAt: new Date() };
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "name")) {
      const name = cleanText(req.body.name, 100);
      if (!name) return res.status(400).json({ error: "A category name is required." });
      updates.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "order")) {
      const order = Number(req.body.order);
      if (!Number.isFinite(order)) return res.status(400).json({ error: "Order must be a number." });
      updates.order = order;
    }

    await categories.updateOne({ _id: id }, { $set: updates });

    if (updates.name && updates.name !== existing.name) {
      await db.collection("playerProgress").updateMany({ category: existing.name }, { $set: { category: updates.name } });
    }

    return res.status(200).json({ category: serialize({ ...existing, ...updates, _id: id }) });
  }

  const result = await categories.deleteOne({ _id: id });
  return result.deletedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "Category not found." });
}

async function progressRoute(req, res, db, session) {
  if (!allowMethods(req, res, ["GET", "POST", "PATCH", "DELETE"])) return;

  const resource = cleanText(req.query?.resource || req.body?.resource, 30).toLowerCase();
  if (resource === "categories") return progressCategoriesRoute(req, res, db);

  if (req.method === "PATCH") return res.status(400).json({ error: "Ratings cannot be edited directly. Submit a new rating instead." });

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
    birthYear: inquiry.birthYear || "", position: inquiry.position || "", eliteProspects: inquiry.eliteProspects || "", files: [], careerStatus: "Youth",
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

  const epFields = {};
  if (document.type === "Player" && isValidEliteProspectsUrl(document.eliteProspects)) {
    const attemptedAt = new Date().toISOString();
    try {
      epFields.epData = await fetchEliteProspectsData(document.eliteProspects);
      epFields.epSync = { lastAttemptedAt: attemptedAt, lastSuccessfulAt: attemptedAt, status: "success", errorCode: null };
    } catch (syncError) {
      epFields.epSync = { lastAttemptedAt: attemptedAt, lastSuccessfulAt: null, status: "error", errorCode: syncError.code || "UNKNOWN_ERROR" };
    }
    await users.updateOne({ _id: inserted.insertedId }, { $set: epFields });
  }

  return res.status(201).json({ message: "Inquiry accepted and setup email sent.", user: serialize({ ...document, ...epFields, _id: inserted.insertedId }) });
}

async function refreshEliteProspectsRoute(req, res, db) {
  if (!allowMethods(req, res, ["POST"])) return;
  const users = db.collection("users");
  const userId = toObjectId(req.body?.userId);
  if (!userId) return res.status(400).json({ error: "A valid user ID is required." });
  const user = await users.findOne({ _id: userId, type: { $regex: /^player$/i } });
  if (!user) return res.status(404).json({ error: "Player account not found." });
  if (!isValidEliteProspectsUrl(user.eliteProspects)) return res.status(400).json({ error: "This player does not have a valid Elite Prospects URL." });

  const attemptedAt = new Date().toISOString();
  try {
    const epData = await fetchEliteProspectsData(user.eliteProspects);
    const epSync = { lastAttemptedAt: attemptedAt, lastSuccessfulAt: attemptedAt, status: "success", errorCode: null };
    await users.updateOne({ _id: userId }, { $set: { epData, epSync } });
    return res.status(200).json({ success: true, epData, epSync });
  } catch (error) {
    const epSync = { lastAttemptedAt: attemptedAt, lastSuccessfulAt: user.epSync?.lastSuccessfulAt || null, status: "error", errorCode: error.code || "UNKNOWN_ERROR" };
    await users.updateOne({ _id: userId }, { $set: { epSync } });
    return res.status(502).json({ error: "Elite Prospects sync failed.", errorCode: epSync.errorCode });
  }
}

const MIN_RESYNC_INTERVAL_MS = 25 * 24 * 60 * 60 * 1000;
const SYNC_REQUEST_DELAY_MS = 5000;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function syncEliteProspectsRoute(req, res, db) {
  if (!allowMethods(req, res, ["GET", "POST"])) return;
  const users = db.collection("users");
  const players = await users.find({ type: { $regex: /^player$/i }, eliteProspects: { $type: "string", $ne: "" } }).toArray();

  let processed = 0, updated = 0, skipped = 0, failed = 0;
  for (const player of players) {
    processed++;
    if (!isValidEliteProspectsUrl(player.eliteProspects)) { skipped++; continue; }

    const lastSuccessfulAt = player.epSync?.lastSuccessfulAt ? new Date(player.epSync.lastSuccessfulAt).getTime() : 0;
    if (lastSuccessfulAt && Date.now() - lastSuccessfulAt < MIN_RESYNC_INTERVAL_MS) { skipped++; continue; }

    const attemptedAt = new Date().toISOString();
    try {
      const epData = await fetchEliteProspectsData(player.eliteProspects);
      await users.updateOne({ _id: player._id }, { $set: { epData, epSync: { lastAttemptedAt: attemptedAt, lastSuccessfulAt: attemptedAt, status: "success", errorCode: null } } });
      updated++;
    } catch (error) {
      await users.updateOne({ _id: player._id }, { $set: { epSync: { lastAttemptedAt: attemptedAt, lastSuccessfulAt: player.epSync?.lastSuccessfulAt || null, status: "error", errorCode: error.code || "UNKNOWN_ERROR" } } });
      failed++;
    }
    await sleep(SYNC_REQUEST_DELAY_MS);
  }
  return res.status(200).json({ processed, updated, skipped, failed });
}

module.exports = async function handler(req, res) {
  try {
    const route = action(req);

    if (route === "synceliteprospects") {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader = req.headers.authorization || "";
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized." });
      const db = await getDb();
      return syncEliteProspectsRoute(req, res, db);
    }

    const session = route === "progress" ? requireStaff(req, res) : requireAdmin(req, res);
    if (!session) return;
    const db = await getDb();
    if (route === "users") return usersRoute(req, res, db);
    if (route === "messages") return messagesRoute(req, res, db, session);
    if (route === "progress") return progressRoute(req, res, db, session);
    if (route === "accept-inquiry") return acceptInquiry(req, res, db);
    if (route === "refresheliteprospects") return refreshEliteProspectsRoute(req, res, db);
    return res.status(404).json({ error: "Admin action not found." });
  } catch (error) {
    console.error("Admin API error:", error);
    return res.status(500).json({ error: "Admin request failed.", details: error.message });
  }
};
