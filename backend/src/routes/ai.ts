import type { FastifyInstance } from "fastify";
import { waha } from "../waha-client.js";
import { runThreadCommand } from "../ai/commands.js";

export async function aiRoutes(app: FastifyInstance) {
  app.post<{ Body: { chatId: string; instruction: string } }>(
    "/api/ai/command",
    async (req, reply) => {
      const { chatId, instruction } = req.body;
      if (!chatId || !instruction?.trim()) {
        reply.code(400);
        return { error: "chatId and instruction are required" };
      }

      const messages = await waha.getMessages(chatId);
      const suggestion = await runThreadCommand(instruction, messages);
      return { suggestion };
    },
  );
}
