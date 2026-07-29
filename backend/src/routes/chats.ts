import type { FastifyInstance } from "fastify";
import { GuardBlockedError, waha, type WahaFileInput } from "../waha-client.js";

export function isValidFile(file: unknown): file is WahaFileInput {
  if (!file || typeof file !== "object") return false;
  const f = file as Record<string, unknown>;
  if (typeof f.mimetype !== "string") return false;
  return typeof f.url === "string" || typeof f.data === "string";
}

/** WhatsApp only accepts these three pin durations (24h / 7d / 30d) — WAHA passes the
 *  `duration` field straight through, so we validate it here rather than let a bad value
 *  surface as an opaque WAHA 4xx. */
export const PIN_DURATIONS = [86400, 604800, 2592000] as const;

export function isValidPinDuration(duration: unknown): duration is number {
  return typeof duration === "number" && (PIN_DURATIONS as readonly number[]).includes(duration);
}

/** Shared by every route that requires non-empty message text (send, edit). */
export function isValidText(text: unknown): text is string {
  return typeof text === "string" && text.trim().length > 0;
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
      if (!isValidText(text)) {
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

  app.post<{ Params: { chatId: string }; Body: { file: WahaFileInput; caption?: string } }>(
    "/api/chats/:chatId/file",
    async (req, reply) => {
      const { file, caption } = req.body;
      if (!isValidFile(file)) {
        reply.code(400);
        return { error: "file (mimetype + url or data) is required" };
      }
      try {
        return await waha.sendFile(req.params.chatId, file, caption);
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
    "/api/chats/:chatId/video",
    async (req, reply) => {
      const { file, caption } = req.body;
      if (!isValidFile(file)) {
        reply.code(400);
        return { error: "file (mimetype + url or data) is required" };
      }
      try {
        return await waha.sendVideo(req.params.chatId, file, caption);
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

  app.post<{ Params: { chatId: string } }>("/api/chats/:chatId/read", async (req) => {
    await waha.markChatRead(req.params.chatId);
    return { ok: true };
  });

  app.post<{ Params: { chatId: string } }>("/api/chats/:chatId/unread", async (req) => {
    await waha.markChatUnread(req.params.chatId);
    return { ok: true };
  });

  app.get<{ Params: { chatId: string } }>("/api/chats/:chatId/presence", async (req) =>
    waha.getPresence(req.params.chatId),
  );

  app.post<{ Params: { chatId: string } }>(
    "/api/chats/:chatId/presence/subscribe",
    async (req) => {
      await waha.subscribePresence(req.params.chatId);
      return { ok: true };
    },
  );

  app.post<{ Params: { chatId: string; messageId: string }; Body: { duration: number } }>(
    "/api/chats/:chatId/messages/:messageId/pin",
    async (req, reply) => {
      const { duration } = req.body;
      if (!isValidPinDuration(duration)) {
        reply.code(400);
        return { error: `duration must be one of: ${PIN_DURATIONS.join(", ")}` };
      }
      await waha.pinMessage(req.params.chatId, req.params.messageId, duration);
      return { ok: true };
    },
  );

  app.post<{ Params: { chatId: string; messageId: string } }>(
    "/api/chats/:chatId/messages/:messageId/unpin",
    async (req) => {
      await waha.unpinMessage(req.params.chatId, req.params.messageId);
      return { ok: true };
    },
  );

  app.post<{ Params: { chatId: string } }>("/api/chats/:chatId/archive", async (req) => {
    await waha.archiveChat(req.params.chatId);
    return { ok: true };
  });

  app.post<{ Params: { chatId: string } }>("/api/chats/:chatId/unarchive", async (req) => {
    await waha.unarchiveChat(req.params.chatId);
    return { ok: true };
  });

  app.delete<{ Params: { chatId: string } }>("/api/chats/:chatId", async (req) => {
    await waha.deleteChat(req.params.chatId);
    return { ok: true };
  });

  app.delete<{ Params: { chatId: string } }>("/api/chats/:chatId/messages", async (req) => {
    await waha.clearChatMessages(req.params.chatId);
    return { ok: true };
  });

  app.delete<{ Params: { chatId: string; messageId: string } }>(
    "/api/chats/:chatId/messages/:messageId",
    async (req) => {
      await waha.deleteMessage(req.params.chatId, req.params.messageId);
      return { ok: true };
    },
  );

  app.put<{ Params: { chatId: string; messageId: string }; Body: { text: string } }>(
    "/api/chats/:chatId/messages/:messageId",
    async (req, reply) => {
      const { text } = req.body;
      if (!isValidText(text)) {
        reply.code(400);
        return { error: "text is required" };
      }
      await waha.editMessage(req.params.chatId, req.params.messageId, text);
      return { ok: true };
    },
  );
}
