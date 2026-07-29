import type { FastifyInstance } from "fastify";
import { waha } from "../waha-client.js";

export async function sessionsRoutes(app: FastifyInstance) {
  app.get("/api/sessions", async () => waha.listSessions());

  app.get("/api/sessions/me", async () => waha.getSessionMe());
}
