import type { FastifyInstance } from "fastify";
import { waha } from "../waha-client.js";

/** Shared by create/update — a label needs a non-empty name; color/colorHex are optional
 *  (WAHA assigns a default when omitted). */
export function isValidLabelName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0;
}

export function isValidLabelIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.every((id) => typeof id === "string");
}

export async function labelsRoutes(app: FastifyInstance) {
  app.get("/api/labels", async () => waha.listLabels());

  app.post<{ Body: { name: string; color?: number; colorHex?: string } }>(
    "/api/labels",
    async (req, reply) => {
      const { name, color, colorHex } = req.body;
      if (!isValidLabelName(name)) {
        reply.code(400);
        return { error: "name is required" };
      }
      return waha.createLabel(name, color, colorHex);
    },
  );

  app.put<{ Params: { id: string }; Body: { name: string; color?: number; colorHex?: string } }>(
    "/api/labels/:id",
    async (req, reply) => {
      const { name, color, colorHex } = req.body;
      if (!isValidLabelName(name)) {
        reply.code(400);
        return { error: "name is required" };
      }
      return waha.updateLabel(req.params.id, name, color, colorHex);
    },
  );

  app.delete<{ Params: { id: string } }>("/api/labels/:id", async (req) => {
    await waha.deleteLabel(req.params.id);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/labels/:id/chats", async (req) =>
    waha.getChatsByLabel(req.params.id),
  );

  app.get<{ Params: { chatId: string } }>("/api/chats/:chatId/labels", async (req) =>
    waha.getChatLabels(req.params.chatId),
  );

  app.put<{ Params: { chatId: string }; Body: { labelIds: string[] } }>(
    "/api/chats/:chatId/labels",
    async (req, reply) => {
      const { labelIds } = req.body;
      if (!isValidLabelIds(labelIds)) {
        reply.code(400);
        return { error: "labelIds must be an array of strings" };
      }
      await waha.setChatLabels(req.params.chatId, labelIds);
      return { ok: true };
    },
  );
}
