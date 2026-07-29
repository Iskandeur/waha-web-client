import type { FastifyInstance } from "fastify";
import { auditLog, sendGuardStatus } from "../guard/index.js";

/** Read-only introspection into the anti-detection guard — lets a human check "is the breaker
 *  open right now" or "what did the guard decide over the last N calls" without grepping logs. */
export async function guardRoutes(app: FastifyInstance) {
  app.get("/api/guard/status", async () => sendGuardStatus());

  app.get<{ Querystring: { limit?: string } }>("/api/guard/log", async (req) => {
    const limit = Number(req.query.limit ?? 100);
    return auditLog.recent(Number.isFinite(limit) ? limit : 100);
  });
}
