const { put, del } = require("@vercel/blob");
const formidable = require("formidable");
const fs = require("node:fs/promises");
const { getDb, toObjectId, serialize } = require("../lib/db");
const { requireSession } = require("../lib/auth");
const { action, allowMethods, cleanText, readJson } = require("../lib/http");

module.exports.config = { api: { bodyParser: false } };

function parseForm(req, maxFileSize) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize, multiples: false });
    form.parse(req, (error, fields, files) => error ? reject(error) : resolve({ fields, files }));
  });
}
function first(value) { return Array.isArray(value) ? value[0] : value; }

async function avatarRoute(req, res, db, session) {
  if (!allowMethods(req, res, ["POST", "DELETE"])) return;
  if (session.role.toLowerCase() !== "player" || !session.userId) return res.status(403).json({ error: "Player access is required." });
  const playerId = toObjectId(session.userId);
  const users = db.collection("users");
  const player = await users.findOne({ _id: playerId });
  if (!player) return res.status(404).json({ error: "Player account not found." });
  if (req.method === "DELETE") {
    if (player.avatarPathname) await del(player.avatarPathname).catch(() => {});
    await users.updateOne({ _id: playerId }, { $unset: { avatarUrl: "", avatarPathname: "" }, $set: { updatedAt: new Date() } });
    return res.status(200).json({ success: true });
  }
  const { files } = await parseForm(req, 8 * 1024 * 1024);
  const file = first(files.file);
  if (!file || !String(file.mimetype || "").startsWith("image/")) return res.status(400).json({ error: "An image file is required." });
  const buffer = await fs.readFile(file.filepath);
  const safeName = String(file.originalFilename || "avatar").replace(/[^a-zA-Z0-9._-]/g, "-");
  const blob = await put(`players/${playerId}/avatar-${Date.now()}-${safeName}`, buffer, { access: "public", contentType: file.mimetype || "application/octet-stream", addRandomSuffix: true });
  if (player.avatarPathname) await del(player.avatarPathname).catch(() => {});
  await users.updateOne({ _id: playerId }, { $set: { avatarUrl: blob.url, avatarPathname: blob.pathname, updatedAt: new Date() } });
  return res.status(201).json({ avatarUrl: blob.url });
}

async function fileRoute(req, res, db, session) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;
  const role = session.role.toLowerCase();
  const collection = db.collection("playerFiles");
  const ownPlayerId = role === "player" ? toObjectId(session.userId) : null;
  if (req.method === "GET") {
    const query = ownPlayerId ? { playerId: ownPlayerId } : {};
    return res.status(200).json({ files: (await collection.find(query).sort({ createdAt: -1 }).toArray()).map(serialize) });
  }
  if (req.method === "POST") {
    const { fields, files } = await parseForm(req, 100 * 1024 * 1024);
    const uploaded = first(files.file);
    if (!uploaded) return res.status(400).json({ error: "File is required." });
    const playerId = ownPlayerId || toObjectId(first(fields.playerId) || first(fields.userId));
    if (!playerId) return res.status(400).json({ error: "Valid player ID is required." });
    const buffer = await fs.readFile(uploaded.filepath);
    const name = String(uploaded.originalFilename || "file");
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const blob = await put(`players/${playerId}/files/${Date.now()}-${safeName}`, buffer, { access: "public", contentType: uploaded.mimetype || "application/octet-stream", addRandomSuffix: true });
    const document = { playerId, name, fileName: name, category: cleanText(first(fields.category), 80) || "Other", note: cleanText(first(fields.note), 1000), mimeType: uploaded.mimetype || "application/octet-stream", size: Number(uploaded.size || buffer.length), url: blob.url, fileUrl: blob.url, pathname: blob.pathname, createdAt: new Date() };
    const result = await collection.insertOne(document);
    return res.status(201).json({ file: serialize({ ...document, _id: result.insertedId }) });
  }
  const body = await readJson(req);
  const id = toObjectId(body.id);
  if (!id) return res.status(400).json({ error: "Valid file ID is required." });
  const query = ownPlayerId ? { _id: id, playerId: ownPlayerId } : { _id: id };
  const file = await collection.findOne(query);
  if (!file) return res.status(404).json({ error: "File not found." });
  if (file.pathname) await del(file.pathname).catch(() => {});
  await collection.deleteOne(query);
  return res.status(200).json({ success: true });
}

module.exports = async function handler(req, res) {
  try {
    const session = requireSession(req, res);
    if (!session) return;
    const db = await getDb();
    const route = action(req) || "files";
    if (route === "avatar") return avatarRoute(req, res, db, session);
    if (route === "files") return fileRoute(req, res, db, session);
    return res.status(404).json({ error: "File action not found." });
  } catch (error) {
    console.error("Files API error:", error);
    return res.status(500).json({ error: "File request failed.", details: error.message });
  }
};
