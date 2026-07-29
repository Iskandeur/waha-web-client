import type { FastifyInstance } from "fastify";
import { GuardBlockedError, waha, type WahaFileInput } from "../waha-client.js";

export function isValidFile(file: unknown): file is WahaFileInput {
  if (!file || typeof file !== "object") return false;
  const f = file as Record<string, unknown>;
  if (typeof f.mimetype !== "string") return false;
  return typeof f.url === "string" || typeof f.data === "string";
}

export async function chatsRoutes(app: FastifyInstance) {
  app.get("/api/chats", async () => waha.chatsOverview());

  app.get<{ Params: { chatId: string } }>(
    "/api/chats/:chatId/messages",
    async (req) => waha.getMessages(req.params.chatId),
  );

  app.get<{ Params: { chatId: string } }>("/api/chats/:chatId/picture", async (req) =>
    waha.getChatPicture(req.params.chatId),
  );

  app.post<{ Params: { chatId: string }; Body: { text: string } }>(
    "/api/chats/:chatId/messages",
    async (req, reply) => {
      const { text } = req.body;
      if (!text || !text.trim()) {
        reply.code(400);
        return { error: "text is required" };
      }
      try {
        return await waha.sendText(req.params.chatId, text);
      } catch (err) {
        if (err instanceof GuardBlockedError) {
          reply.code(429);
          return { error: "blocked-by-guard", reason: err.reason };
        }
        throw err;
      }
    },
  );

  app.post<{ Params: { chatId: string }; Body: { file: WahaFileInput; caption?: string } }>(
    "/api/chats/:chatId/image",
    async (req, reply) => {
      const { file, caption } = req.body;
      if (!isValidFile(file)) {
        reply.code(400);
        return { error: "file (mimetype + url or data) is required" };
      }
      try {
        return await waha.sendImage(req.params.chatId, file, caption);
      } catch (err) {
        if (err instanceof GuardBlockedError) {
          reply.code(429);
          return { error: "blocked-by-guard", reason: err.reason };
        }
        throw err;
      }
    },
  );

  app.put<{ Params: { chatId: string; messageId: string }; Body: { reaction: string } }>(
    "/api/chats/:chatId/messages/:messageId/reaction",
    async (req, reply) => {
      const { reaction } = req.body;
      if (typeof reaction !== "string") {
        reply.code(400);
        return { error: "reaction is required (empty string removes it)" };
      }
      return waha.setReaction(req.params.messageId, reaction);
    },
  );

  app.put<{ Params: { chatId: string; messageId: string }; Body: { star: boolean } }>(
    "/api/chats/:chatId/messages/:messageId/star",
    async (req, reply) => {
      const { star } = req.body;
      if (typeof star !== "boolean") {
        reply.code(400);
        return { error: "star (boolean) is required" };
      }
      return waha.setStar(req.params.messageId, req.params.chatId, star);
    },
  );
}
