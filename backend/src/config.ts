import { randomBytes } from "node:crypto";

export const config = {
  wahaBaseUrl: process.env.WAHA_BASE_URL ?? "http://localhost:3000",
  wahaApiKey: process.env.WAHA_API_KEY ?? "",
  wahaSession: process.env.WAHA_SESSION ?? "default",
  port: Number(process.env.PORT ?? 8787),
  claudeBin: process.env.CLAUDE_BIN ?? "claude",
  // PIN gate for public deployments (see access-gate.ts). Empty = gate disabled.
  accessPin: process.env.ACCESS_PIN ?? "",
  // Signs the session cookie. Falls back to a per-boot random secret so an unset value can never
  // silently sign with an empty/predictable key — it just makes cookies from before a restart
  // invalid, which is fine for a stateless demo gate.
  accessSessionSecret:
    process.env.ACCESS_SESSION_SECRET ?? randomBytes(32).toString("hex"),
};
