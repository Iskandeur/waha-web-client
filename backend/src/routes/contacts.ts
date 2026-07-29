import type { FastifyInstance } from "fastify";
import { waha } from "../waha-client.js";

/** A phone number "shaped" enough to send to WAHA — digits only, WhatsApp's shortest real
 *  numbers run ~8 digits (a `+` prefix or spaces are stripped by the caller before this). */
export function isValidPhone(phone: unknown): phone is string {
  return typeof phone === "string" && /^\d{6,15}$/.test(phone.trim());
}

export async function contactsRoutes(app: FastifyInstance) {
  app.get("/api/contacts", async () => waha.listContacts());

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
}
