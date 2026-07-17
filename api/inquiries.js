const { getDb, toObjectId, serialize } = require("../lib/db");
const { getSession } = require("../lib/auth");
const { allowMethods, cleanText } = require("../lib/http");
const { isValidEliteProspectsUrl } = require("../lib/eliteProspects");

module.exports = async function handler(req, res) {
  try {
    if (!allowMethods(req, res, ["GET", "POST", "DELETE"])) return;
    const db = await getDb();
    const collection = db.collection("inquiries");

    if (req.method === "POST") {
      const body = req.body || {};
      const role = cleanText(body.role, 30).toLowerCase();
      if (!body.firstName || !body.lastName || !role || !body.email) {
        return res.status(400).json({ error: "First name, last name, role, and email are required." });
      }
      if (!["player", "coach", "advisor"].includes(role)) {
        return res.status(400).json({ error: "Role must be player, coach, or advisor." });
      }
      const eliteProspectsUrl = role === "player" ? cleanText(body.eliteProspects, 300) : "";
      const document = {
        firstName: cleanText(body.firstName, 100),
        lastName: cleanText(body.lastName, 100),
        role,
        position: cleanText(body.position, 50),
        birthYear: cleanText(body.birthYear, 10),
        phoneNumber: cleanText(body.phoneNumber, 50),
        email: cleanText(body.email, 200).toLowerCase(),
        goals: cleanText(body.goals, 2000),
        eliteProspects: eliteProspectsUrl && isValidEliteProspectsUrl(eliteProspectsUrl) ? eliteProspectsUrl : "",
        createdAt: new Date()
      };
      const result = await collection.insertOne(document);
      return res.status(201).json({ message: "Inquiry submitted successfully.", inquiry: serialize({ ...document, _id: result.insertedId }) });
    }

    const session = getSession(req);
    if (!session || session.role.toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Admin access is required." });
    }

    if (req.method === "GET") {
      return res.status(200).json((await collection.find({}).sort({ createdAt: -1 }).toArray()).map(serialize));
    }

    const id = toObjectId(req.body?.id);
    if (!id) return res.status(400).json({ error: "Valid inquiry ID is required." });
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount ? res.status(200).json({ success: true }) : res.status(404).json({ error: "Inquiry not found." });
  } catch (error) {
    console.error("Inquiries API error:", error);
    return res.status(500).json({ error: "Inquiry request failed.", details: error.message });
  }
};
