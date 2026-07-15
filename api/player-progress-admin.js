import { getDatabase, serializeDocument, toObjectId } from "./_lib/db.js";
import { requireStaff } from "./_lib/auth.js";
import { allowMethods, cleanText } from "./_lib/http.js";

export default async function handler(request, response) {
  if (!allowMethods(request, response, ["GET", "POST", "DELETE"])) return;
  const session = requireStaff(request, response);
  if (!session) return;

  const db = await getDatabase();
  const collection = db.collection("playerProgress");

  if (request.method === "GET") {
    const playerId = toObjectId(request.query?.playerId);
    if (!playerId) return response.status(400).json({ error: "Valid playerId is required." });
    const ratings = await collection.find({ playerId }).sort({ createdAt: -1 }).toArray();
    return response.status(200).json({ ratings: ratings.map(serializeDocument) });
  }

  if (request.method === "POST") {
    const playerId = toObjectId(request.body?.playerId);
    const rating = Math.max(0, Math.min(100, Number(request.body?.rating)));
    const category = cleanText(request.body?.category, 100);
    if (!playerId || !category || !Number.isFinite(rating)) {
      return response.status(400).json({ error: "playerId, category, and a 0-100 rating are required." });
    }

    const staffId = toObjectId(session.userId);
    const staff = staffId ? await db.collection("users").findOne({ _id: staffId }) : null;
    const evaluator = `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim() || session.role;
    const document = {
      playerId,
      category,
      rating,
      note: cleanText(request.body?.note, 1000),
      evaluator,
      evaluatorId: staffId,
      evaluatorRole: session.role,
      createdAt: new Date()
    };

    const result = await collection.insertOne(document);
    return response.status(201).json({ rating: serializeDocument({ ...document, _id: result.insertedId }) });
  }

  const id = toObjectId(request.body?.id);
  if (!id) return response.status(400).json({ error: "Valid rating ID is required." });
  const result = await collection.deleteOne({ _id: id });
  if (!result.deletedCount) return response.status(404).json({ error: "Rating not found." });
  return response.status(200).json({ success: true });
}
