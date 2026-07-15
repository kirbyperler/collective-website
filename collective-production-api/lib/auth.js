const { createHmac, timingSafeEqual } = require("crypto");

function readCookie(req, name) {
  const header = req.headers?.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function verifySessionToken(token) {
  if (!token || !process.env.SESSION_SECRET) return null;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  const expected = createHmac("sha256", process.env.SESSION_SECRET)
    .update(payloadPart).digest("base64url");
  const a = Buffer.from(signaturePart);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (Number(payload.expiresAt || 0) < Date.now()) return null;
    return { userId: payload.userId ? String(payload.userId) : null, role: String(payload.role || "") };
  } catch { return null; }
}

function getSession(req) {
  return verifySessionToken(readCookie(req, "collective_session"));
}

function requireSession(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return null;
  }
  return session;
}

function requirePlayer(req, res) {
  const session = requireSession(req, res);
  if (!session) return null;
  if (session.role.toLowerCase() !== "player" || !session.userId) {
    res.status(403).json({ error: "Player access is required." });
    return null;
  }
  return session;
}

function requireStaff(req, res) {
  const session = requireSession(req, res);
  if (!session) return null;
  if (!["admin", "coach", "advisor"].includes(session.role.toLowerCase())) {
    res.status(403).json({ error: "Staff access is required." });
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  const session = requireSession(req, res);
  if (!session) return null;
  if (session.role.toLowerCase() !== "admin") {
    res.status(403).json({ error: "Admin access is required." });
    return null;
  }
  return session;
}

module.exports = { getSession, requireSession, requirePlayer, requireStaff, requireAdmin };
