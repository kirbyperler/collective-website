const { put, del } = require("@vercel/blob");
const { formidable } = require("formidable");
const fs = require("node:fs/promises");

const { getDb, toObjectId, serialize } = require("../lib/db");
const { getSession } = require("../lib/auth");
const { action, allowMethods, cleanText, readJson } = require("../lib/http");

// NOTE ON PRIVACY: Blobs are uploaded with access: "public" (matching the
// project's existing behavior). Anyone who obtains a file's URL can view it
// without authentication - these are not access-controlled downloads.
// Making documents truly private would require switching to
// access: "private" and adding an authenticated download/streaming route
// (using the Blob SDK's `get()` with BLOB_READ_WRITE_TOKEN) since private
// Blob URLs cannot be opened directly by the browser. That is out of scope
// for this session; see the final report.

const FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function parseForm(req, maxFileSize) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize, multiples: false });
    form.parse(req, (error, fields, files) => {
      if (error) return reject(error);
      resolve({ fields, files });
    });
  });
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isPlayer(session) {
  return normalizeRole(session?.role) === "player";
}

function isAdmin(session) {
  return normalizeRole(session?.role) === "admin";
}

// Strips any path segments and unsafe characters so a client-supplied name
// can never influence the Blob pathname beyond a short, safe token.
function sanitizeFilename(rawName) {
  const base = String(rawName || "").split(/[\\/]/).pop() || "";
  const cleaned = base
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 150);
  return cleaned || "file";
}

function buildPathname(ownerId, folder, rawName) {
  return `players/${ownerId}/${folder}/${Date.now()}-${sanitizeFilename(rawName)}`;
}

function validateUpload(file, allowedTypes, maxSize) {
  if (!file) return "A file is required.";
  if (!String(file.originalFilename || "").trim()) return "The file must have a name.";
  const mimeType = String(file.mimetype || "").toLowerCase();
  if (!allowedTypes.has(mimeType)) return "Unsupported file type.";
  const size = Number(file.size || 0);
  if (!size) return "The file is empty.";
  if (size > maxSize) return "The file exceeds the maximum allowed size.";
  return null;
}

// formidable's internal error codes for an oversized upload (see
// node_modules/formidable/src/FormidableError.js).
const FORMIDABLE_SIZE_ERROR_CODES = new Set([1009, 1016]);

function isUploadSizeError(error) {
  return Boolean(error) && FORMIDABLE_SIZE_ERROR_CODES.has(error.code);
}

async function cleanupBlob(pathname) {
  if (!pathname) return;
  await del(pathname).catch((error) => {
    console.error("Blob cleanup error:", error.message);
  });
}

// Determines which player account a request may act on. Players may only
// ever act on their own account. Admins may target any player via an
// explicit id. Coach/advisor accounts are denied outright: the repo has no
// player-assignment system for them, so granting broad access would be
// unsafe.
async function resolveOwner(db, session, candidateRaw) {
  if (isPlayer(session)) {
    const selfId = toObjectId(session.userId);
    if (!selfId) {
      return { error: 401, message: "The session contains an invalid player ID." };
    }
    if (candidateRaw && String(toObjectId(candidateRaw) || "") !== String(selfId)) {
      return { error: 403, message: "Players may only manage their own account." };
    }
    return { ownerId: selfId };
  }

  if (isAdmin(session)) {
    const ownerId = toObjectId(candidateRaw);
    if (!ownerId) {
      return { error: 400, message: "A valid player ID is required." };
    }
    const player = await db.collection("users").findOne({
      _id: ownerId,
      type: { $regex: /^player$/i }
    });
    if (!player) {
      return { error: 404, message: "Player account not found." };
    }
    return { ownerId, player };
  }

  return { error: 403, message: "Forbidden." };
}

function serializeFile(file) {
  const serialized = serialize(file);
  const id = String(serialized.id || serialized._id || "");
  return {
    ...serialized,
    id,
    _id: id,
    playerId: serialized.playerId ? String(serialized.playerId) : "",
    ownerId: serialized.ownerId
      ? String(serialized.ownerId)
      : serialized.playerId
      ? String(serialized.playerId)
      : "",
    uploadedBy: serialized.uploadedBy ? String(serialized.uploadedBy) : "",
    uploadedById: serialized.uploadedById ? String(serialized.uploadedById) : ""
  };
}

async function avatarRoute(req, res, db, session) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;

  if (!isPlayer(session) && !isAdmin(session)) {
    return res.status(403).json({ error: "Forbidden." });
  }

  const users = db.collection("users");

  async function loadOwnerPlayer(candidateRaw) {
    const owner = await resolveOwner(db, session, candidateRaw);
    if (owner.error) return owner;
    const player =
      owner.player ||
      (await users.findOne({ _id: owner.ownerId, type: { $regex: /^player$/i } }));
    if (!player) return { error: 404, message: "Player account not found." };
    return { ownerId: owner.ownerId, player };
  }

  if (req.method === "GET") {
    const candidateRaw = first(req.query?.playerId) || first(req.query?.userId) || "";
    const owner = await loadOwnerPlayer(candidateRaw);
    if (owner.error) return res.status(owner.error).json({ error: owner.message });

    return res.status(200).json({
      avatarUrl: owner.player.avatarUrl || "",
      url: owner.player.avatarUrl || ""
    });
  }

  if (req.method === "DELETE") {
    const candidateRaw = first(req.query?.playerId) || first(req.query?.userId) || "";
    const owner = await loadOwnerPlayer(candidateRaw);
    if (owner.error) return res.status(owner.error).json({ error: owner.message });

    const oldPathname = owner.player.avatarPathname;

    await users.updateOne(
      { _id: owner.ownerId },
      {
        $unset: { avatarUrl: "", avatarPathname: "" },
        $set: { updatedAt: new Date() }
      }
    );

    if (oldPathname) {
      await cleanupBlob(oldPathname).catch((error) => {
        console.error("Avatar cleanup after delete failed:", error.message);
      });
    }

    return res.status(200).json({ success: true, avatarUrl: "" });
  }

  // POST
  let parsed;
  try {
    parsed = await parseForm(req, MAX_AVATAR_SIZE);
  } catch (error) {
    console.error("Avatar multipart parsing failed:", error);
    return res.status(400).json({
      error: isUploadSizeError(error)
        ? "The image exceeds the maximum allowed size."
        : "The uploaded image could not be read."
    });
  }

  const uploaded = first(parsed.files.file);
  const validationError = validateUpload(uploaded, AVATAR_TYPES, MAX_AVATAR_SIZE);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const candidateRaw = first(parsed.fields.playerId) || first(parsed.fields.userId) || "";
  const owner = await loadOwnerPlayer(candidateRaw);
  if (owner.error) return res.status(owner.error).json({ error: owner.message });

  const mimeType = String(uploaded.mimetype || "").toLowerCase();
  const pathname = buildPathname(owner.ownerId, "avatar", uploaded.originalFilename || "avatar");

  let blob;
  try {
    const buffer = await fs.readFile(uploaded.filepath);
    blob = await put(pathname, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: true
    });
  } catch (error) {
    console.error("Avatar blob upload error:", error.message);
    return res.status(500).json({ error: "The avatar could not be uploaded. Please try again." });
  }

  try {
    await users.updateOne(
      { _id: owner.ownerId },
      {
        $set: {
          avatarUrl: blob.url,
          avatarPathname: blob.pathname,
          updatedAt: new Date()
        }
      }
    );
  } catch (error) {
    console.error("Avatar metadata update error:", error.message);
    await cleanupBlob(blob.pathname);
    return res.status(500).json({ error: "The avatar could not be saved. Please try again." });
  }

  if (owner.player.avatarPathname) {
    await cleanupBlob(owner.player.avatarPathname);
  }

  return res.status(201).json({ success: true, avatarUrl: blob.url, url: blob.url });
}

async function fileRoute(req, res, db, session) {
  if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;

  if (!isPlayer(session) && !isAdmin(session)) {
    return res.status(403).json({ error: "Forbidden." });
  }

  const files = db.collection("playerFiles");

  if (req.method === "GET") {
    const candidateRaw = first(req.query?.playerId) || first(req.query?.ownerId) || "";

    let query = {};
    if (isPlayer(session) || candidateRaw) {
      const owner = await resolveOwner(db, session, candidateRaw);
      if (owner.error) return res.status(owner.error).json({ error: owner.message });
      query = { playerId: owner.ownerId };
    }
    // Admins with no candidate id see every file (preserves prior behavior).

    const records = await files.find(query).sort({ createdAt: -1 }).toArray();
    return res.status(200).json({ files: records.map(serializeFile) });
  }

  if (req.method === "POST") {
    let parsed;
    try {
      parsed = await parseForm(req, MAX_FILE_SIZE);
    } catch (error) {
      console.error("File multipart parsing failed:", error);
      return res.status(400).json({
        error: isUploadSizeError(error)
          ? "The file exceeds the maximum allowed size."
          : "The uploaded file could not be read."
      });
    }

    const uploaded = first(parsed.files.file);
    const validationError = validateUpload(uploaded, FILE_TYPES, MAX_FILE_SIZE);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const candidateRaw = first(parsed.fields.playerId) || first(parsed.fields.ownerId) || "";
    const owner = await resolveOwner(db, session, candidateRaw);
    if (owner.error) return res.status(owner.error).json({ error: owner.message });

    const name = String(uploaded.originalFilename || "file").trim();
    const mimeType = String(uploaded.mimetype || "application/octet-stream").toLowerCase();
    const pathname = buildPathname(owner.ownerId, "files", name);

    let blob;
    try {
      const buffer = await fs.readFile(uploaded.filepath);
      blob = await put(pathname, buffer, {
        access: "public",
        contentType: mimeType,
        addRandomSuffix: true
      });
    } catch (error) {
      console.error("Blob upload error:", error.message);
      return res.status(500).json({ error: "The file could not be uploaded. Please try again." });
    }

    const now = new Date();
    const document = {
      ownerId: owner.ownerId,
      playerId: owner.ownerId,

      uploadedBy: toObjectId(session.userId),
      uploadedById: toObjectId(session.userId),
      uploadedByRole: session.role || "",

      originalName: name,
      displayName: name,
      name,
      fileName: name,

      category: cleanText(first(parsed.fields.category), 80) || "Other",
      note: cleanText(first(parsed.fields.note), 1000),

      contentType: mimeType,
      mimeType,
      size: Number(uploaded.size || 0),

      url: blob.url,
      fileUrl: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
      pathname: blob.pathname,

      visibility: cleanText(first(parsed.fields.visibility), 20) || "private",

      createdAt: now,
      updatedAt: now
    };

    let result;
    try {
      result = await files.insertOne(document);
    } catch (error) {
      console.error("File metadata insert error:", error.message);
      await cleanupBlob(blob.pathname);
      return res.status(500).json({ error: "The file could not be saved. Please try again." });
    }

    return res.status(201).json({
      success: true,
      file: serializeFile({ ...document, _id: result.insertedId })
    });
  }

  // DELETE
  const body = await readJson(req);
  const id = toObjectId(body.id || first(req.query?.id));

  if (!id) {
    return res.status(400).json({ error: "A valid file ID is required." });
  }

  const record = await files.findOne({ _id: id });

  if (!record) {
    return res.status(404).json({ error: "File not found." });
  }

  if (isPlayer(session)) {
    const selfId = toObjectId(session.userId);
    if (!selfId || String(record.playerId) !== String(selfId)) {
      return res.status(403).json({ error: "You do not have permission to delete this file." });
    }
  } else if (!isAdmin(session)) {
    return res.status(403).json({ error: "Forbidden." });
  }

  await cleanupBlob(record.pathname);
  await files.deleteOne({ _id: id });

  return res.status(200).json({ success: true });
}

module.exports = async function handler(req, res) {
  try {
    const session = await getSession(req);

    if (!session) {
      return res.status(401).json({ error: "No active session." });
    }

    const role = normalizeRole(session.role);

    if (!["player", "admin", "coach", "advisor"].includes(role)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const db = await getDb();
    const route = action(req) || "files";

    if (route === "avatar") {
      return avatarRoute(req, res, db, session);
    }

    if (route === "files") {
      return fileRoute(req, res, db, session);
    }

    return res.status(404).json({ error: "File action not found." });
  } catch (error) {
    console.error("Files API error:", error.message);

    return res.status(500).json({ error: "File request failed." });
  }
};

module.exports.config = { api: { bodyParser: false } };
