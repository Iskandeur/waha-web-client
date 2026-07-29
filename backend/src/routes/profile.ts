import type { FastifyInstance } from "fastify";
import { waha, type WahaFileInput } from "../waha-client.js";
import { isValidFile } from "./chats.js";

/** Profile name/status just need non-empty text — WhatsApp itself allows clearing "About" with
 *  an empty string, so unlike the name this only rejects non-string input. */
export function isValidProfileName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0;
}

export function isValidProfileStatus(status: unknown): status is string {
  return typeof status === "string";
}

export async function profileRoutes(app: FastifyInstance) {
  app.get("/api/profile", async () => waha.getProfile());

  app.put<{ Body: { name: string } }>("/api/profile/name", async (req, reply) => {
    const { name } = req.body;
    if (!isValidProfileName(name)) {
      reply.code(400);
      return { error: "name is required" };
    }
    return waha.setProfileName(name.trim());
  });

  app.put<{ Body: { status: string } }>("/api/profile/status", async (req, reply) => {
    const { status } = req.body;
    if (!isValidProfileStatus(status)) {
      reply.code(400);
      return { error: "status must be a string" };
    }
    return waha.setProfileStatus(status);
  });

  app.put<{ Body: { file: WahaFileInput } }>("/api/profile/picture", async (req, reply) => {
    const { file } = req.body;
    if (!isValidFile(file)) {
      reply.code(400);
      return { error: "file (mimetype + url or data) is required" };
    }
    return waha.setProfilePicture(file);
  });

  app.delete("/api/profile/picture", async () => waha.deleteProfilePicture());
}
