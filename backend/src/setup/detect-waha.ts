export interface ProbeResult {
  found: boolean;
  status?: number;
  reason: string;
}

const DEFAULT_TIMEOUT_MS = 1500;

/** Best-effort check for a WAHA instance already listening at `baseUrl`, used by `npm run setup`
 *  to decide between "use what's already running" and "start the bundled disposable instance"
 *  (see `docker-compose.yml` at the repo root). Hits WAHA's `/api/server/version` endpoint:
 *
 *  - 200 with a `version` field in the body → definitely WAHA.
 *  - 401/403 → still treated as "found". WAHA requires an API key on most builds, so a
 *    correctly-configured instance answers with a 401 here rather than 200 — a plain port scan
 *    can't tell that apart from "nothing's listening", but we can, and a 401 is itself strong
 *    evidence something WAHA-shaped is behind the port.
 *  - anything else (connection refused, timeout, an unrelated service on that port) → not found. */
export async function probeWaha(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/api/server/version`, {
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return { found: true, status: res.status, reason: "waha-auth-required" };
    }
    if (res.status !== 200) {
      return { found: false, status: res.status, reason: `unexpected-status-${res.status}` };
    }
    const body: unknown = await res.json().catch(() => null);
    const hasVersionField =
      body !== null && typeof body === "object" && "version" in (body as Record<string, unknown>);
    return hasVersionField
      ? { found: true, status: 200, reason: "waha-version-endpoint" }
      : { found: false, status: 200, reason: "responded-but-not-waha-shaped" };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return { found: false, reason: timedOut ? "timeout" : "connection-failed" };
  } finally {
    clearTimeout(timer);
  }
}

export type SetupChoice =
  | { kind: "use-configured"; baseUrl: string }
  | { kind: "use-detected"; baseUrl: string; probe: ProbeResult }
  | { kind: "start-bundled" };

/** `existingBaseUrl` — pass `undefined` for "not deliberately configured yet" (the setup CLI
 *  treats a freshly-copied `.env.example` placeholder value the same as unset, since that's the
 *  common first-run state, not an actual choice). A deliberate value always wins over detection:
 *  never override a user's explicit configuration with what we happened to find on the network. */
export function decideWahaSetup(
  existingBaseUrl: string | undefined,
  candidateUrl: string,
  probe: ProbeResult,
): SetupChoice {
  if (existingBaseUrl) return { kind: "use-configured", baseUrl: existingBaseUrl };
  if (probe.found) return { kind: "use-detected", baseUrl: candidateUrl, probe };
  return { kind: "start-bundled" };
}
