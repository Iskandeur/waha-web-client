import { config } from "./config.js";
import type { GuardActionKind } from "./guard/audit-log.js";

export type RealConnectionDecision = { allow: true } | { allow: false; reason: string };

/** Gate in front of every WAHA call once `WAHA_REAL_CONNECTION=true` — see
 *  docs/real-connection-plan.md for why this exists and how to move through its phases. A
 *  no-op (always allows) while the flag is unset/false, which is every deploy that existed
 *  before this guard was added, including the public demo and local disposable-WAHA dev setup.
 *
 *  Two independent checks once enabled, both required for anything beyond a read:
 *   1. session allowlist — `WAHA_REAL_CONNECTION_SESSION` must match the session actually in
 *      use, so real-connection mode can only ever reach the one session it was pinned to (e.g.
 *      a misconfigured `WAHA_SESSION` can't silently reach a different, unintended session).
 *   2. read-only phase — `WAHA_REAL_CONNECTION_WRITE` must also be `"true"`, else every
 *      non-"read" call (send, presence, group) is refused before it reaches WAHA at all. */
export function checkRealConnection(
  session: string,
  kind: GuardActionKind,
): RealConnectionDecision {
  if (!config.realConnection.enabled) return { allow: true };

  if (session !== config.realConnection.allowedSession) {
    return {
      allow: false,
      reason: `real-connection-session-mismatch (session "${session}" is not the allowed "${config.realConnection.allowedSession}")`,
    };
  }

  if (kind !== "read" && !config.realConnection.writeEnabled) {
    return { allow: false, reason: `real-connection-read-only (kind "${kind}" blocked)` };
  }

  return { allow: true };
}
