function readCookie(request, cookieName) {
  const cookieHeader = request.headers?.cookie || request.headers?.get?.("cookie") || "";
  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === cookieName) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeSessionValue(value) {
  if (!value) return null;

  const candidates = [value];
  const jwtParts = value.split(".");
  if (jwtParts.length >= 2) candidates.unshift(jwtParts[1]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(decodeBase64Url(candidate));
    } catch {
      try {
        return JSON.parse(candidate);
      } catch {
        // Try the next representation.
      }
    }
  }

  return null;
}

export function getSession(request) {
  const configuredName = process.env.SESSION_COOKIE_NAME || "session";
  const possibleNames = [configuredName, "collective_session", "auth_session"];

  for (const name of possibleNames) {
    const payload = decodeSessionValue(readCookie(request, name));
    if (!payload) continue;

    const expiresAt = Number(payload.expiresAt || payload.exp || 0);
    if (expiresAt && expiresAt < Date.now() && expiresAt * 1000 < Date.now()) {
      return null;
    }

    return {
      userId: String(payload.userId || payload.id || payload.sub || ""),
      role: String(payload.role || payload.type || "")
    };
  }

  return null;
}

export function requirePlayer(request, response) {
  const session = getSession(request);

  if (!session?.userId) {
    response.status(401).json({ error: "You must be logged in." });
    return null;
  }

  if (session.role && session.role.toLowerCase() !== "player") {
    response.status(403).json({ error: "Player access is required." });
    return null;
  }

  return session;
}

export function requireStaff(request, response) {
  const session = getSession(request);
  const role = session?.role?.toLowerCase();

  if (!session?.userId || !["admin", "coach", "advisor"].includes(role)) {
    response.status(403).json({ error: "Staff access is required." });
    return null;
  }

  return session;
}
