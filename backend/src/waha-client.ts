import { config } from "./config.js";
import {
  auditLog,
  circuitBreaker,
  evaluateSend,
  recordSendAttempt,
  typingDurationMs,
  type GuardActionKind,
} from "./guard/index.js";

export interface WahaChat {
  id: string;
  name?: string;
  lastMessage?: unknown;
  [key: string]: unknown;
}

export interface WahaMessage {
  id: string;
  timestamp: number;
  from: string;
  fromMe: boolean;
  body: string;
  [key: string]: unknown;
}

/** Matches WAHA's `MessageImageRequest.file` — either a remote URL or inline base64 data,
 *  both tagged with a mimetype (WAHA's own `RemoteFile` / `BinaryFile` schemas). */
export type WahaFileInput =
  | { mimetype: string; filename?: string; url: string }
  | { mimetype: string; filename?: string; data: string };

export class WahaError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`WAHA request failed (${status}): ${body}`);
  }
}

/** Thrown when the anti-detection guard refuses a call outright — the caller never reaches
 *  WAHA at all (see `reason` for why: a rate limit, the circuit breaker, a burst/duplicate
 *  pattern, etc). Routes should turn this into a 429, not a 500. */
export class GuardBlockedError extends Error {
  constructor(public reason: string) {
    super(`Blocked by anti-detection guard: ${reason}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WahaCallMeta {
  kind: GuardActionKind;
  session: string;
  chatId?: string;
}

/** The ONLY function in this codebase that performs an HTTP call against WAHA. Every entry in
 *  `waha` below funnels through here, and every call — reads included — passes the circuit
 *  breaker check and gets logged, which is what makes "no WAHA request bypasses the guard"
 *  true structurally rather than by convention. Send-specific throttling (rate limits, jitter,
 *  typing simulation, burst/duplicate detection) is layered on top in `waha.sendText`, since
 *  those rules only make sense for the action that's actually visible to WhatsApp's abuse
 *  detection — but even that richer path ends up calling this same function to hit the wire. */
async function wahaFetch<T>(path: string, init: RequestInit, meta: WahaCallMeta): Promise<T> {
  const now = Date.now();

  if (circuitBreaker.isOpen(now)) {
    auditLog.push({
      ts: now,
      kind: meta.kind,
      session: meta.session,
      chatId: meta.chatId,
      decision: "blocked",
      reason: "circuit-breaker-open",
    });
    throw new GuardBlockedError("circuit-breaker-open");
  }

  const url = `${config.wahaBaseUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (config.wahaApiKey) headers["X-Api-Key"] = config.wahaApiKey;

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err) {
    circuitBreaker.recordFailure(now);
    throw err;
  }

  const text = await res.text();
  if (!res.ok) {
    circuitBreaker.recordFailure(now);
    auditLog.push({
      ts: now,
      kind: meta.kind,
      session: meta.session,
      chatId: meta.chatId,
      decision: "allowed",
      reason: `waha-error-${res.status}`,
    });
    throw new WahaError(res.status, text);
  }

  circuitBreaker.recordSuccess(now);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/** Shared plumbing behind every message-send kind (text, image, ...): runs the send-guard
 *  decision (circuit-breaker / rate-limit / burst / duplicate-content checks — may throw
 *  `GuardBlockedError`), applies its jittered delay, records the attempt for the guard's own
 *  bookkeeping, simulates typing, then hands off to `perform` for the actual WAHA call. `text`
 *  is whatever text content best represents the message for the guard's duplicate-content
 *  check (the message body for text, the caption for media). */
async function sendGuarded<T>(
  chatId: string,
  text: string,
  session: string,
  perform: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const decision = evaluateSend(chatId, text, session, now);

  if (!decision.allow) {
    auditLog.push({
      ts: now,
      kind: "send",
      session,
      chatId,
      decision: "blocked",
      reason: decision.reason,
    });
    throw new GuardBlockedError(decision.reason);
  }

  auditLog.push({
    ts: now,
    kind: "send",
    session,
    chatId,
    decision: decision.delayMs > 0 ? "delayed" : "allowed",
    reason: decision.reason,
    delayMs: decision.delayMs,
  });

  if (decision.delayMs > 0) await delay(decision.delayMs);

  recordSendAttempt(chatId, text, session);

  // Typing simulation is best-effort: a hiccup on the presence call must never block or
  // fail the send itself, and it deliberately still passes through wahaFetch (kind:
  // "presence") so it counts toward the circuit breaker like any other WAHA call.
  await waha.startTyping(chatId, session).catch(() => undefined);
  await delay(typingDurationMs(text));
  await waha.stopTyping(chatId, session).catch(() => undefined);

  return perform();
}

/** Thin wrapper over the subset of the WAHA REST API this client needs.
 *  See https://waha.devlike.pro/ for the full API surface. */
export const waha = {
  listSessions: (session = config.wahaSession) =>
    wahaFetch<unknown[]>("/api/sessions", {}, { kind: "read", session }),

  listChats: (session = config.wahaSession) =>
    wahaFetch<WahaChat[]>(`/api/${session}/chats`, {}, { kind: "read", session }),

  chatsOverview: (session = config.wahaSession, limit = 50) =>
    wahaFetch<WahaChat[]>(
      `/api/${session}/chats/overview?limit=${limit}`,
      {},
      { kind: "read", session },
    ),

  getMessages: (chatId: string, session = config.wahaSession, limit = 100) =>
    wahaFetch<WahaMessage[]>(
      `/api/${session}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`,
      {},
      { kind: "read", session, chatId },
    ),

  getChatPicture: (chatId: string, session = config.wahaSession) =>
    wahaFetch<{ url: string | null }>(
      `/api/${session}/chats/${encodeURIComponent(chatId)}/picture`,
      {},
      { kind: "read", session, chatId },
    ),

  startTyping: (chatId: string, session = config.wahaSession) =>
    wahaFetch<void>(
      "/api/startTyping",
      { method: "POST", body: JSON.stringify({ session, chatId }) },
      { kind: "presence", session, chatId },
    ),

  stopTyping: (chatId: string, session = config.wahaSession) =>
    wahaFetch<void>(
      "/api/stopTyping",
      { method: "POST", body: JSON.stringify({ session, chatId }) },
      { kind: "presence", session, chatId },
    ),

  /** The only way to send a text message in this codebase — there is no lower-level
   *  "send now, unguarded" path exposed. See `sendGuarded` for what that means in practice. */
  sendText: (chatId: string, text: string, session = config.wahaSession) =>
    sendGuarded(chatId, text, session, () =>
      wahaFetch<WahaMessage>(
        "/api/sendText",
        { method: "POST", body: JSON.stringify({ session, chatId, text }) },
        { kind: "send", session, chatId },
      ),
    ),

  /** Same guard path as `sendText` (a media message is just as visible to WhatsApp's abuse
   *  detection as a text one) — the caption stands in for "text" in the duplicate-content
   *  check. */
  sendImage: (chatId: string, file: WahaFileInput, caption = "", session = config.wahaSession) =>
    sendGuarded(chatId, caption, session, () =>
      wahaFetch<WahaMessage>(
        "/api/sendImage",
        { method: "POST", body: JSON.stringify({ session, chatId, file, caption }) },
        { kind: "send", session, chatId },
      ),
    ),

  /** Reactions and stars are lightweight, low-frequency mutations, not "message sends" in the
   *  abuse-pattern sense the send-guard's rate/burst/duplicate rules were tuned for (reacting
   *  with the same emoji in several chats is normal, not a spam signal) — so these skip
   *  `sendGuarded` but still go through `wahaFetch`, which means they're still covered by the
   *  circuit breaker and the audit log. */
  setReaction: (messageId: string, reaction: string, session = config.wahaSession) =>
    wahaFetch<void>(
      "/api/reaction",
      { method: "PUT", body: JSON.stringify({ session, messageId, reaction }) },
      { kind: "send", session },
    ),

  setStar: (messageId: string, chatId: string, star: boolean, session = config.wahaSession) =>
    wahaFetch<void>(
      "/api/star",
      { method: "PUT", body: JSON.stringify({ session, messageId, chatId, star }) },
      { kind: "send", session, chatId },
    ),
};
