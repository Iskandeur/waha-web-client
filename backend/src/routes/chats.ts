import type { FastifyInstance } from "fastify";
import { GuardBlockedError, waha, type WahaFileInput } from "../waha-client.js";

/** WAHA's `MessageLocationRequest` requires real-world coordinates (lat in [-90, 90], lng in
 *  [-180, 180]) — validated here so a bad value 400s instead of surfacing as an opaque WAHA error. */
export function isValidLatitude(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isValidLongitude(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -180 && n <= 180;
}

/** The chat/contact JID being shared (e.g. `123456789@c.us`) — same shape as any other chatId. */
export function isValidContactId(id: unknown): id is string {
  return typeof id === "string" && id.trim().length > 0;
}

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

/** WhatsApp polls allow 2-12 options (WAHA passes the array straight through) — validated here
 *  so a malformed poll 400s instead of surfacing as an opaque WAHA error. */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 12;

export function isValidPollName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0;
}

export function isValidPollOptions(options: unknown): options is string[] {
  if (!Array.isArray(options)) return false;
  if (options.length < POLL_MIN_OPTIONS || options.length > POLL_MAX_OPTIONS) return false;
  return options.every((o) => typeof o === "string" && o.trim().length > 0);
}

/** Votes are the option texts the voter picked — an empty array retracts the vote, so only
 *  the shape (an array of non-empty strings) is checked here, not a minimum length. */
export function isValidVotes(votes: unknown): votes is string[] {
  return Array.isArray(votes) && votes.every((v) => typeof v === "string" && v.trim().length > 0);
}

/** How many messages we ask WAHA for per chat. WAHA's `GET .../messages` has no total-count or
 *  "has more" field in its response (verified against the live instance's own OpenAPI spec) —
 *  it's a bare array, capped at whatever `limit` we pass. So "did we get exactly `limit` back"
 *  is the only real (non-guessed) signal we have that older history exists but wasn't fetched. */
export const MESSAGES_FETCH_LIMIT = 100;

/** `offset` must be a non-negative integer (or absent) — anything else 400s instead of
 *  surfacing as an opaque WAHA error or, worse, silently coercing to `NaN`/0. */
export function isValidOffset(offset: unknown): offset is number {
  return typeof offset === "number" && Number.isInteger(offset) && offset >= 0;
}

export async function chatsRoutes(app: FastifyInstance) {
  app.get("/api/chats", async () => waha.chatsOverview());

  app.get<{ Params: { chatId: string }; Querystring: { offset?: string } }>(
    "/api/chats/:chatId/messages",
    async (req, reply) => {
      const rawOffset = req.query.offset;
      const offset = rawOffset === undefined ? 0 : Number(rawOffset);
      if (!isValidOffset(offset)) {
        reply.code(400);
        return { error: "offset must be a non-negative integer" };
      }
      const messages = await waha.getMessages(
        req.params.chatId,
        undefined,
        MESSAGES_FETCH_LIMIT,
        offset,
      );
      return {
        messages,
        limit: MESSAGES_FETCH_LIMIT,
        offset,
        // True = we hit the requested cap, so older messages likely exist but weren't loaded
        // *at this offset* yet — the frontend re-checks this after every "load older" page too,
        // so pagination naturally stops once a page comes back short. False only means "WAHA
        // returned fewer than we asked for this session" — it is NOT a guarantee this matches
        // the complete history on the phone (WhatsApp Web/multi-device sessions don't always
        // sync full pre-link history; see README "Live demo"/coverage doc).
        truncated: messages.length >= MESSAGES_FETCH_LIMIT,
      };
    },
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

  app.post<{ Params: { chatId: string }; Body: { file: WahaFileInput } }>(
    "/api/chats/:chatId/voice",
    async (req, reply) => {
      const { file } = req.body;
      if (!isValidFile(file)) {
        reply.code(400);
        return { error: "file (mimetype + url or data) is required" };
      }
      try {
        return await waha.sendVoice(req.params.chatId, file);
      } catch (err) {
        if (err instanceof GuardBlockedError) {
          reply.code(429);
          return { error: "blocked-by-guard", reason: err.reason };
        }
        throw err;
      }
    },
  );

  app.post<{
    Params: { chatId: string };
    Body: { name: string; options: string[]; multipleAnswers?: boolean };
  }>("/api/chats/:chatId/poll", async (req, reply) => {
    const { name, options, multipleAnswers } = req.body;
    if (!isValidPollName(name)) {
      reply.code(400);
      return { error: "name (poll question) is required" };
    }
    if (!isValidPollOptions(options)) {
      reply.code(400);
      return {
        error: `options must be an array of ${POLL_MIN_OPTIONS}-${POLL_MAX_OPTIONS} non-empty strings`,
      };
    }
    try {
      return await waha.sendPoll(req.params.chatId, name, options, multipleAnswers ?? false);
    } catch (err) {
      if (err instanceof GuardBlockedError) {
        reply.code(429);
        return { error: "blocked-by-guard", reason: err.reason };
      }
      throw err;
    }
  });

  app.post<{ Params: { chatId: string; messageId: string }; Body: { votes: string[] } }>(
    "/api/chats/:chatId/messages/:messageId/poll-vote",
    async (req, reply) => {
      const { votes } = req.body;
      if (!isValidVotes(votes)) {
        reply.code(400);
        return { error: "votes must be an array of option strings (empty array retracts)" };
      }
      await waha.sendPollVote(req.params.chatId, req.params.messageId, votes);
      return { ok: true };
    },
  );

  app.post<{ Params: { chatId: string }; Body: { latitude: number; longitude: number; title?: string } }>(
    "/api/chats/:chatId/location",
    async (req, reply) => {
      const { latitude, longitude, title } = req.body;
      if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
        reply.code(400);
        return { error: "latitude/longitude must be valid coordinates" };
      }
      try {
        return await waha.sendLocation(
          req.params.chatId,
          latitude,
          longitude,
          title?.trim() || "Shared location",
        );
      } catch (err) {
        if (err instanceof GuardBlockedError) {
          reply.code(429);
          return { error: "blocked-by-guard", reason: err.reason };
        }
        throw err;
      }
    },
  );

  app.post<{
    Params: { chatId: string };
    Body: { contactId: string; name?: string; phoneNumber?: string };
  }>("/api/chats/:chatId/contact", async (req, reply) => {
    const { contactId, name, phoneNumber } = req.body;
    if (!isValidContactId(contactId)) {
      reply.code(400);
      return { error: "contactId is required" };
    }
    const whatsappId = contactId.replace(/@.*$/, "");
    const fullName = name?.trim() || whatsappId;
    try {
      return await waha.sendContactVcard(req.params.chatId, [
        { fullName, phoneNumber: phoneNumber?.trim() || whatsappId, whatsappId, vcard: null },
      ]);
    } catch (err) {
      if (err instanceof GuardBlockedError) {
        reply.code(429);
        return { error: "blocked-by-guard", reason: err.reason };
      }
      throw err;
    }
  });

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
