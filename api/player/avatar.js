import { put, del } from "@vercel/blob";
import formidable from "formidable";
import fs from "node:fs/promises";
import { getDatabase, toObjectId } from "../_lib/db.js";
import { requirePlayer } from "../_lib/auth.js";
import { allowMethods } from "../_lib/http.js";

export const config = { api: { bodyParser: false } };

function parseForm(request) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 8 * 1024 * 1024, multiples: false });
    form.parse(request, (error, fields, files) => error ? reject(error) : resolve({ fields, files }));
  });
}

function firstFile(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request, response) {
  if (!allowMethods(request, response, ["POST", "DELETE"])) return;
  const session = requirePlayer(request, response);
  if (!session) return;

  const playerId = toObjectId(session.userId);
  if (!playerId) return response.status(400).json({ error: "Invalid session user ID." });

  const db = await getDatabase();
  const users = db.collection("users");
  const player = await users.findOne({ _id: playerId });
  if (!player) return response.status(404).json({ error: "Player account not found." });

  if (request.method === "DELETE") {
    if (player.avatarPathname) await del(player.avatarPathname).catch(() => {});
    await users.updateOne({ _id: playerId }, { $unset: { avatarUrl: "", avatarPathname: "" }, $set: { updatedAt: new Date() } });
    return response.status(200).json({ success: true });
  }

  const { files } = await parseForm(request);
  const file = firstFile(files.file);
  if (!file) return response.status(400).json({ error: "Image file is required." });
  if (!String(file.mimetype || "").startsWith("image/")) return response.status(400).json({ error: "Avatar must be an image." });

  const buffer = await fs.readFile(file.filepath);
  const safeName = String(file.originalFilename || "avatar").replace(/[^a-zA-Z0-9._-]/g, "-");
  const blob = await put(`players/${playerId}/avatar-${Date.now()}-${safeName}`, buffer, {
    access: "public",
    contentType: file.mimetype || "application/octet-stream",
    addRandomSuffix: true
  });

  if (player.avatarPathname) await del(player.avatarPathname).catch(() => {});
  await users.updateOne({ _id: playerId }, { $set: { avatarUrl: blob.url, avatarPathname: blob.pathname, updatedAt: new Date() } });
  return response.status(201).json({ avatarUrl: blob.url });
}
