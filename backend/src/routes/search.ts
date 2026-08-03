import type { FastifyInstance } from "fastify";
import { waha } from "../waha-client.js";
import { createMessageIndex, type MessageIndex } from "../search/message-index.js";

/** Two characters is the shortest query worth walking an index for — one letter matches most
 *  of any history and would just be a slow way to render noise. */
export const MIN_QUERY_LENGTH = 2;
/** One unhealthy chat must not stall the progressive index indefinitely. This aborts the actual
 *  WAHA fetch (rather than merely racing it and leaving a hidden request running). */
export const SEARCH_READ_TIMEOUT_MS = 10_000;

export function isValidSearchQuery(query: unknown): query is string {
  return typeof query === "string" && query.trim().length >= MIN_QUERY_LENGTH;
}

/** Process-wide index: built on the first search, shared by every request afterwards (see
 *  search/message-index.ts for why it isn't rebuilt per call). */
const defaultIndex: MessageIndex = createMessageIndex({
  listChats: () => waha.chatsOverview(),
  getMessages: (chatId, limit, offset) =>
    waha.getMessages(
      chatId,
      undefined,
      limit,
      offset,
      AbortSignal.timeout(SEARCH_READ_TIMEOUT_MS),
    ),
});

export function searchRoutes(index: MessageIndex = defaultIndex) {
  return async function register(app: FastifyInstance) {
    app.get<{
      Querystring: { q?: string; chatId?: string; limit?: string };
    }>("/api/search", async (req, reply) => {
      const { q, chatId, limit } = req.query;
      if (!isValidSearchQuery(q)) {
        reply.code(400);
        return { error: `q must be at least ${MIN_QUERY_LENGTH} characters` };
      }
      const parsedLimit = limit === undefined ? undefined : Number(limit);
      if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
        reply.code(400);
        return { error: "limit must be a positive integer" };
      }
      // A WAHA failure (or a guard block) propagates to the app-wide error handler, which
      // turns GuardBlockedError into a 429 — same contract as every other route.
      const result = await index.search(q, {
        chatId: chatId?.trim() || undefined,
        limit: parsedLimit,
        // A first index can take longer than a public reverse proxy timeout because WAHA reads
        // are intentionally sequential. Return partial progress immediately; the UI polls this
        // shared build instead of spawning another one or holding one HTTP request open.
        waitForBuild: false,
      });
      if (result.stats.building) reply.code(202);
      return result;
    });
  };
}
