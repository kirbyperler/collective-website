import { getDatabase, serializeDocument, toObjectId } from "../_lib/db.js";
import { requirePlayer } from "../_lib/auth.js";
import { allowMethods, cleanText } from "../_lib/http.js";

export default async function handler(request, response) {
  if (!allowMethods(request, response, ["GET", "POST", "DELETE"])) return;
  const session = requirePlayer(request, response);
  if (!session) return;

  const playerId = toObjectId(session.userId);
  if (!playerId) return response.status(400).json({ error: "Invalid session user ID." });

  const db = await getDatabase();
  const collection = db.collection("playerPrograms");

  if (request.method === "GET") {
    const records = await collection.find({ playerId }).sort({ createdAt: -1 }).toArray();
    return response.status(200).json({
      interestedInPlayer: records.filter(item => item.type === "interestedInPlayer").map(serializeDocument),
      playerInterested: records.filter(item => item.type === "playerInterested").map(serializeDocument)
    });
  }

  if (request.method === "POST") {
    const type = request.body?.type;
    const name = cleanText(request.body?.name, 120);
    const level = cleanText(request.body?.level, 40);
    const contact = cleanText(request.body?.contact, 300);

    if (!["interestedInPlayer", "playerInterested"].includes(type) || !name) {
      return response.status(400).json({ error: "Program type and name are required." });
    }

    const document = { playerId, type, name, level, contact, createdAt: new Date(), updatedAt: new Date() };
    const result = await collection.insertOne(document);
    return response.status(201).json({ program: serializeDocument({ ...document, _id: result.insertedId }) });
  }

  const programId = toObjectId(request.body?.id);
  if (!programId) return response.status(400).json({ error: "Valid program ID is required." });

  const result = await collection.deleteOne({ _id: programId, playerId });
  if (!result.deletedCount) return response.status(404).json({ error: "Program not found." });
  return response.status(200).json({ success: true });
}
