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
  const messages = db.collection("messages");
  const users = db.collection("users");

  if (request.method === "GET") {
    const records = await messages.find({
      $and: [
        { $or: [{ senderId: playerId }, { recipientId: playerId }, { userId: playerId }] },
        { deletedFor: { $ne: String(playerId) } }
      ]
    }).sort({ createdAt: -1 }).toArray();

    return response.status(200).json({
      messages: records.map(record => ({
        ...serializeDocument(record),
        direction: String(record.senderId) === String(playerId) ? "sent" : "received"
      }))
    });
  }

  if (request.method === "POST") {
    const recipientId = toObjectId(request.body?.recipientId);
    const subject = cleanText(request.body?.subject, 150);
    const text = cleanText(request.body?.text, 4000);

    if (!recipientId || !text) {
      return response.status(400).json({ error: "Recipient and message are required." });
    }

    const [sender, recipient] = await Promise.all([
      users.findOne({ _id: playerId }),
      users.findOne({ _id: recipientId })
    ]);

    if (!recipient) return response.status(404).json({ error: "Recipient not found." });

    const senderName = `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim() || "Player";
    const toName = `${recipient.firstName || ""} ${recipient.lastName || ""}`.trim() || "Collective Staff";
    const document = {
      userId: playerId,
      senderId: playerId,
      recipientId,
      senderName,
      fromName: senderName,
      toName,
      type: "Player Message",
      subject,
      text,
      read: false,
      deletedFor: [],
      createdAt: new Date()
    };

    const result = await messages.insertOne(document);
    return response.status(201).json({ message: { ...serializeDocument({ ...document, _id: result.insertedId }), direction: "sent" } });
  }

  const messageId = toObjectId(request.body?.id);
  if (!messageId) return response.status(400).json({ error: "Valid message ID is required." });

  const result = await messages.updateOne(
    { _id: messageId, $or: [{ senderId: playerId }, { recipientId: playerId }, { userId: playerId }] },
    { $addToSet: { deletedFor: String(playerId) } }
  );

  if (!result.matchedCount) return response.status(404).json({ error: "Message not found." });
  return response.status(200).json({ success: true });
}
