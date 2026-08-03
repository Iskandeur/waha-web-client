import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { sessionsRoutes } from "./routes/sessions.js";
import { chatsRoutes } from "./routes/chats.js";
import { contactsRoutes } from "./routes/contacts.js";
import { aiRoutes } from "./routes/ai.js";
import { guardRoutes } from "./routes/guard.js";
import { labelsRoutes } from "./routes/labels.js";
import { groupsRoutes } from "./routes/groups.js";
import { profileRoutes } from "./routes/profile.js";
import { accessRoutes } from "./routes/access.js";
import { searchRoutes } from "./routes/search.js";
import { GuardBlockedError } from "./waha-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(__dirname, "../../frontend/dist");

/** Builds and registers the whole app but never calls `listen()` — kept separate from
 *  `server.ts` so tests can `app.inject()` against real routes without binding a socket. */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // Gates every request behind ACCESS_PIN when set (see routes/access.ts) — registered directly
  // (not via app.register()) so its onRequest hook applies to every route below, not just its own.
  await accessRoutes(app);

  // Every `waha.*` call funnels through wahaFetch (see waha-client.ts), which throws
  // GuardBlockedError for anything the anti-detection/real-connection guards refuse — set here,
  // once, so every route (present and future) turns that into a 429 instead of an opaque 500,
  // rather than relying on each route handler to catch it individually.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof GuardBlockedError) {
      reply.code(429).send({ error: "blocked-by-guard", reason: err.reason });
      return;
    }
    reply.send(err);
  });

  app.get("/api/health", async () => ({ ok: true }));

  await app.register(sessionsRoutes);
  await app.register(chatsRoutes);
  await app.register(contactsRoutes);
  await app.register(aiRoutes);
  await app.register(guardRoutes);
  await app.register(labelsRoutes);
  await app.register(groupsRoutes);
  await app.register(profileRoutes);
  await app.register(searchRoutes());

  // Serves the built frontend (frontend/dist) when present — lets a single container run the
  // static demo without a separate web server. Absent in plain `npm run dev:backend` (frontend
  // isn't built yet), which is fine: the dev workflow runs the Vite dev server separately.
  if (existsSync(frontendDist)) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      wildcard: false,
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.method !== "GET" || req.url.startsWith("/api/")) {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      reply.sendFile("index.html");
    });
  }

  return app;
}
