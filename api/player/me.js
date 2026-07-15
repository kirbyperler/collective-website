import { getDatabase, serializeDocument, toObjectId } from "../_lib/db.js";
import { requirePlayer } from "../_lib/auth.js";
import { allowMethods, cleanText } from "../_lib/http.js";

const editableFields = [
  "firstName", "lastName", "birthYear", "position", "currentTeam",
  "shoots", "height", "weight", "email", "phone", "careerStatus", "bio"
];

export default async function handler(request, response) {
  if (!allowMethods(request, response, ["GET", "PATCH"])) return;
  const session = requirePlayer(request, response);
  if (!session) return;

  const userId = toObjectId(session.userId);
  if (!userId) return response.status(400).json({ error: "Invalid session user ID." });

  const db = await getDatabase();
  const users = db.collection("users");

  if (request.method === "GET") {
    const player = await users.findOne({ _id: userId, type: { $in: ["Player", "player"] } });
    if (!player) return response.status(404).json({ error: "Player account not found." });
    return response.status(200).json({ player: serializeDocument(player) });
  }

  const updates = {};
  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(request.body || {}, field)) {
      updates[field] = cleanText(request.body[field], field === "bio" ? 1500 : 200);
    }
  }

  const validStatuses = ["Youth", "Prep", "Juniors", "College", "Pro"];
  if (updates.careerStatus && !validStatuses.includes(updates.careerStatus)) {
    return response.status(400).json({ error: "Invalid career status." });
  }

  updates.updatedAt = new Date();
  const result = await users.findOneAndUpdate(
    { _id: userId, type: { $in: ["Player", "player"] } },
    { $set: updates },
    { returnDocument: "after" }
  );

  const player = result?.value || result;
  if (!player) return response.status(404).json({ error: "Player account not found." });
  return response.status(200).json({ player: serializeDocument(player) });
}
