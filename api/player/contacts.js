import { getDatabase, serializeDocument } from "../_lib/db.js";
import { requirePlayer } from "../_lib/auth.js";
import { allowMethods } from "../_lib/http.js";

export default async function handler(request, response) {
  if (!allowMethods(request, response, ["GET"])) return;
  if (!requirePlayer(request, response)) return;

  const db = await getDatabase();
  const contacts = await db.collection("users")
    .find({ type: { $in: ["Admin", "Coach", "Advisor", "admin", "coach", "advisor"] } })
    .project({ firstName: 1, lastName: 1, type: 1, role: 1, email: 1 })
    .sort({ type: 1, firstName: 1 })
    .toArray();

  response.status(200).json({
    contacts: contacts.map(contact => ({
      ...serializeDocument(contact),
      name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
      role: contact.role || contact.type
    }))
  });
}
