const { getDb, toObjectId, serialize } = require("../lib/db");
const { requirePlayer } = require("../lib/auth");
const { action, allowMethods, cleanText } = require("../lib/http");

async function meRoute(req, res, db, playerId) {
  if (!allowMethods(req, res, ["GET", "PATCH"])) return;
  const users = db.collection("users");
  if (req.method === "GET") {
    const player = await users.findOne({ _id: playerId, type: { $in: ["Player", "player"] } });
    return player ? res.status(200).json({ player: serialize(player) }) : res.status(404).json({ error: "Player account not found." });
  }
  const updates = {};
  for (const field of ["firstName","lastName","birthYear","position","currentTeam","shoots","height","weight","email","phone","careerStatus","bio"]) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) updates[field] = cleanText(req.body[field], field === "bio" ? 1500 : 200);
  }
  if (updates.careerStatus && !["Youth","Prep","Juniors","College","Pro"].includes(updates.careerStatus)) return res.status(400).json({ error: "Invalid career status." });
  updates.updatedAt = new Date();
  const result = await users.findOneAndUpdate({ _id: playerId }, { $set: updates }, { returnDocument: "after" });
  const player = result?.value || result;
  return player ? res.status(200).json({ player: serialize(player) }) : res.status(404).json({ error: "Player account not found." });
}

async function contactsRoute(req, res, db) {
  if (!allowMethods(req, res, ["GET"])) return;

  const records = await db
    .collection("users")
    .find({
      type: {
        $in: ["Admin", "Coach", "Advisor", "admin", "coach", "advisor"]
      }
    })
    .project({ firstName: 1, lastName: 1, type: 1, role: 1, email: 1 })
    .sort({ type: 1, firstName: 1 })
    .toArray();

  const contacts = records.map(item => ({
    ...serialize(item),
    name: `${item.firstName || ""} ${item.lastName || ""}`.trim(),
    role: item.role || item.type
  }));

  // The admin account is stored in Vercel environment variables rather
  // than the users collection, so expose a virtual contact for players.
  contacts.unshift({
    id: "admin",
    _id: "admin",
    name: "Collective Admin",
    role: "Admin"
  });

  return res.status(200).json({ contacts });
}

async function messagesRoute(req, res, db, playerId) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;
  const messages = db.collection("messages");
  const users = db.collection("users");
  if (req.method === "GET") {
    const records = await messages.find({ $and: [{ $or: [{ senderId: playerId }, { recipientId: playerId }, { userId: playerId }] }, { deletedFor: { $ne: String(playerId) } }] }).sort({ createdAt: -1 }).toArray();
    return res.status(200).json({ messages: records.map(record => ({ ...serialize(record), direction: String(record.senderId || "") === String(playerId) ? "sent" : "received" })) });
  }
  if (req.method === "POST") {
    const rawRecipientId = String(req.body?.recipientId || "");
    const recipientId = toObjectId(rawRecipientId);
    const sendingToAdmin = rawRecipientId.toLowerCase() === "admin";
    const text = cleanText(req.body?.text, 4000);

    if ((!recipientId && !sendingToAdmin) || !text) {
      return res.status(400).json({
        error: "Recipient and message are required."
      });
    }

    const sender = await users.findOne({ _id: playerId });
    const recipient = recipientId
      ? await users.findOne({ _id: recipientId })
      : null;

    if (recipientId && !recipient) {
      return res.status(404).json({ error: "Recipient not found." });
    }

    const senderName = `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim() || "Player";
    const toName = sendingToAdmin
      ? "Collective Admin"
      : `${recipient?.firstName || ""} ${recipient?.lastName || ""}`.trim() || "Collective Staff";

    const document = {
      userId: playerId,
      senderId: playerId,
      recipientId: recipientId || null,
      recipientRole: sendingToAdmin ? "Admin" : recipient?.type || "Staff",
      senderName,
      fromName: senderName,
      toName,
      type: "Player Message",
      subject: cleanText(req.body?.subject, 150),
      text,
      read: false,
      deletedFor: [],
      createdAt: new Date()
    };
    const result = await messages.insertOne(document);
    return res.status(201).json({ message: { ...serialize({ ...document, _id: result.insertedId }), direction: "sent" } });
  }
  const id = toObjectId(req.body?.id);
  if (!id) return res.status(400).json({ error: "Valid message ID is required." });
  const result = await messages.updateOne({ _id: id, $or: [{ senderId: playerId }, { recipientId: playerId }, { userId: playerId }] }, { $addToSet: { deletedFor: String(playerId) } });
  return result.matchedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "Message not found." });
}

async function programsRoute(req, res, db, playerId) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;
  const collection = db.collection("playerPrograms");
  if (req.method === "GET") {
    const records = await collection.find({ playerId }).sort({ createdAt: -1 }).toArray();
    return res.status(200).json({ interestedInPlayer: records.filter(x => x.type === "interestedInPlayer").map(serialize), playerInterested: records.filter(x => x.type === "playerInterested").map(serialize) });
  }
  if (req.method === "POST") {
    const type = req.body?.type;
    const name = cleanText(req.body?.name, 120);
    if (!["interestedInPlayer","playerInterested"].includes(type) || !name) return res.status(400).json({ error: "Program type and name are required." });
    const document = { playerId, type, name, level: cleanText(req.body?.level, 40), contact: cleanText(req.body?.contact, 300), createdAt: new Date(), updatedAt: new Date() };
    const result = await collection.insertOne(document);
    return res.status(201).json({ program: serialize({ ...document, _id: result.insertedId }) });
  }
  const id = toObjectId(req.body?.id);
  if (!id) return res.status(400).json({ error: "Valid program ID is required." });
  const result = await collection.deleteOne({ _id: id, playerId });
  return result.deletedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "Program not found." });
}

async function progressRoute(req, res, db, playerId) {
  if (!allowMethods(req, res, ["GET"])) return;
  const ratings = await db.collection("playerProgress").find({ playerId }).sort({ createdAt: -1 }).toArray();
  return res.status(200).json({ ratings: ratings.map(serialize) });
}

module.exports = async function handler(req, res) {
  try {
    const session = requirePlayer(req, res);
    if (!session) return;
    const playerId = toObjectId(session.userId);
    if (!playerId) return res.status(400).json({ error: "Invalid session user ID." });
    const db = await getDb();
    const route = action(req);
    if (route === "me") return meRoute(req, res, db, playerId);
    if (route === "contacts") return contactsRoute(req, res, db);
    if (route === "messages") return messagesRoute(req, res, db, playerId);
    if (route === "programs") return programsRoute(req, res, db, playerId);
    if (route === "progress") return progressRoute(req, res, db, playerId);
    return res.status(404).json({ error: "Player action not found." });
  } catch (error) {
    console.error("Player API error:", error);
    return res.status(500).json({ error: "Player request failed.", details: error.message });
  }
};
