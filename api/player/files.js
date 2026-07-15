import { put, del } from "@vercel/blob";
import formidable from "formidable";
import fs from "node:fs/promises";
import { getDatabase, serializeDocument, toObjectId } from "../_lib/db.js";
import { requirePlayer } from "../_lib/auth.js";
import { allowMethods, cleanText } from "../_lib/http.js";

export const config = { api: { bodyParser: false } };

function parseForm(request) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: 100 * 1024 * 1024, multiples: false });
    form.parse(request, (error, fields, files) => error ? reject(error) : resolve({ fields, files }));
  });
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request, response) {
  if (!allowMethods(request, response, ["GET", "POST", "DELETE"])) return;
  const session = requirePlayer(request, response);
  if (!session) return;

  const playerId = toObjectId(session.userId);
  if (!playerId) return response.status(400).json({ error: "Invalid session user ID." });

  const db = await getDatabase();
  const collection = db.collection("playerFiles");

  if (request.method === "GET") {
    const records = await collection.find({ playerId }).sort({ createdAt: -1 }).toArray();
    return response.status(200).json({ files: records.map(serializeDocument) });
  }

  if (request.method === "POST") {
    const { fields, files } = await parseForm(request);
    const uploadedFile = first(files.file);
    if (!uploadedFile) return response.status(400).json({ error: "File is required." });

    const buffer = await fs.readFile(uploadedFile.filepath);
    const name = String(uploadedFile.originalFilename || "file");
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const blob = await put(`players/${playerId}/files/${Date.now()}-${safeName}`, buffer, {
      access: "public",
      contentType: uploadedFile.mimetype || "application/octet-stream",
      addRandomSuffix: true
    });

    const document = {
      playerId,
      name,
      fileName: name,
      category: cleanText(first(fields.category), 80) || "Other",
      note: cleanText(first(fields.note), 1000),
      mimeType: uploadedFile.mimetype || "application/octet-stream",
      size: Number(uploadedFile.size || buffer.length),
      url: blob.url,
      pathname: blob.pathname,
      createdAt: new Date()
    };

    const result = await collection.insertOne(document);
    return response.status(201).json({ file: serializeDocument({ ...document, _id: result.insertedId }) });
  }

  const fileId = toObjectId(request.body?.id);
  if (!fileId) return response.status(400).json({ error: "Valid file ID is required." });

  const file = await collection.findOne({ _id: fileId, playerId });
  if (!file) return response.status(404).json({ error: "File not found." });

  if (file.pathname) await del(file.pathname).catch(() => {});
  await collection.deleteOne({ _id: fileId, playerId });
  return response.status(200).json({ success: true });
}
