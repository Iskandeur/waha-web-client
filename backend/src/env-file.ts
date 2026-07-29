import { existsSync, readFileSync } from "node:fs";

/** Zero-dependency .env loader (no `dotenv` package in this repo's dependency tree). Fills in
 *  any `KEY=value` line from `envPath` that isn't already set in `process.env` — real
 *  environment variables (docker-compose `environment:`, CI, a shell export) always win over
 *  the file, matching the usual .env convention. A missing file is a no-op, not an error, so
 *  this is safe to call unconditionally before a `.env` has been created yet. */
export function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
