import { randomBytes } from "node:crypto";

export const config = {
  wahaBaseUrl: process.env.WAHA_BASE_URL ?? "http://localhost:3000",
  wahaApiKey: process.env.WAHA_API_KEY ?? "",
  wahaSession: process.env.WAHA_SESSION ?? "default",
  port: Number(process.env.PORT ?? 8787),
  // Interface the HTTP server binds to (see bind-guard.ts). Defaults to loopback-only — a
  // deployment that genuinely needs to listen more broadly (e.g. no reverse proxy/tunnel in
  // front) must set this explicitly, and bind-guard refuses to start unless ACCESS_PIN is also
  // set, so a wide-open bind can never happen silently.
  host: process.env.HOST ?? "127.0.0.1",
  claudeBin: process.env.CLAUDE_BIN ?? "claude",
  // PIN gate for public deployments (see access-gate.ts). Empty = gate disabled.
  accessPin: process.env.ACCESS_PIN ?? "",
  // Signs the session cookie. Falls back to a per-boot random secret so an unset value can never
  // silently sign with an empty/predictable key — it just makes cookies from before a restart
  // invalid, which is fine for a stateless demo gate.
  accessSessionSecret:
    process.env.ACCESS_SESSION_SECRET ?? randomBytes(32).toString("hex"),
  // Real-connection guard (see docs/real-connection-plan.md) — gates pointing this backend at
  // a real, valued WAHA session instead of a disposable/test one. All three default OFF: unset
  // env vars reproduce the exact behavior this codebase had before these flags existed.
  realConnection: {
    enabled: process.env.WAHA_REAL_CONNECTION === "true",
    allowedSession: process.env.WAHA_REAL_CONNECTION_SESSION ?? "",
    writeEnabled: process.env.WAHA_REAL_CONNECTION_WRITE === "true",
  },
};
