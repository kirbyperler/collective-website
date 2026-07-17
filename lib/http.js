function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods);
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
  return false;
}

function cleanText(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function action(req) {
  return cleanText(req.query?.action, 80).toLowerCase();
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

module.exports = { allowMethods, cleanText, action, readJson, escapeRegex };
