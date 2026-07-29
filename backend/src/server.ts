import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { sessionsRoutes } from "./routes/sessions.js";
import { chatsRoutes } from "./routes/chats.js";
import { aiRoutes } from "./routes/ai.js";
import { guardRoutes } from "./routes/guard.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/api/health", async () => ({ ok: true }));

await app.register(sessionsRoutes);
await app.register(chatsRoutes);
await app.register(aiRoutes);
await app.register(guardRoutes);

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
