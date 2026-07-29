import type { FastifyInstance } from "fastify";
import { GuardBlockedError, waha } from "../waha-client.js";

export async function chatsRoutes(app: FastifyInstance) {
  app.get("/api/chats", async () => waha.chatsOverview());

  app.get<{ Params: { chatId: string } }>(
    "/api/chats/:chatId/messages",
    async (req) => waha.getMessages(req.params.chatId),
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
}
