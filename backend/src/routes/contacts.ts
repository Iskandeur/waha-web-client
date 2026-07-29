import type { FastifyInstance } from "fastify";
import { waha } from "../waha-client.js";
import { isValidContactId } from "./chats.js";

/** A phone number "shaped" enough to send to WAHA — digits only, WhatsApp's shortest real
 *  numbers run ~8 digits (a `+` prefix or spaces are stripped by the caller before this). */
export function isValidPhone(phone: unknown): phone is string {
  return typeof phone === "string" && /^\d{6,15}$/.test(phone.trim());
}

export async function contactsRoutes(app: FastifyInstance) {
  app.get("/api/contacts", async () => waha.listContacts());

  app.get<{ Params: { id: string } }>("/api/contacts/:id", async (req, reply) => {
    const { id } = req.params;
    if (!isValidContactId(id)) {
      reply.code(400);
      return { error: "contact id is required" };
    }
    return waha.getContact(id);
  });

  app.get<{ Querystring: { phone?: string } }>(
    "/api/contacts/check-exists",
    async (req, reply) => {
      const phone = req.query.phone?.trim();
      if (!isValidPhone(phone)) {
        reply.code(400);
        return { error: "phone must be 6-15 digits" };
      }
      return waha.checkNumberExists(phone);
    },
  );

  app.get<{ Querystring: { contactId?: string } }>(
    "/api/contacts/about",
    async (req, reply) => {
      const { contactId } = req.query;
      if (!isValidContactId(contactId)) {
        reply.code(400);
        return { error: "contactId is required" };
      }
      return waha.getContactAbout(contactId);
    },
  );

  app.post<{ Body: { contactId?: string } }>("/api/contacts/block", async (req, reply) => {
    const { contactId } = req.body;
    if (!isValidContactId(contactId)) {
      reply.code(400);
      return { error: "contactId is required" };
    }
    await waha.blockContact(contactId);
    return { ok: true };
  });

  app.post<{ Body: { contactId?: string } }>("/api/contacts/unblock", async (req, reply) => {
    const { contactId } = req.body;
    if (!isValidContactId(contactId)) {
      reply.code(400);
      return { error: "contactId is required" };
    }
    await waha.unblockContact(contactId);
    return { ok: true };
  });
}
