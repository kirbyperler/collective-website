import { getDatabase, serializeDocument, toObjectId } from "../_lib/db.js";
import { requirePlayer } from "../_lib/auth.js";
import { allowMethods } from "../_lib/http.js";

export default async function handler(request, response) {
  if (!allowMethods(request, response, ["GET"])) return;
  const session = requirePlayer(request, response);
  if (!session) return;

  const playerId = toObjectId(session.userId);
  if (!playerId) return response.status(400).json({ error: "Invalid session user ID." });

  const db = await getDatabase();
  const ratings = await db.collection("playerProgress")
    .find({ playerId })
    .sort({ createdAt: -1 })
    .toArray();

  response.status(200).json({ ratings: ratings.map(serializeDocument) });
}
