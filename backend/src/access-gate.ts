import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

/** PIN gate for public deployments (VPS demo, etc.) — modeled on the same idea as bounce-cti's
 *  PIN auth: a stateless signed cookie, no session store. Opt-in: if ACCESS_PIN is unset, the
 *  gate is disabled entirely (self-hosted/local use doesn't need a PIN wall in front of itself). */

export const COOKIE_NAME = "wsp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const gateEnabled = () => config.accessPin.length > 0;

/** Constant-time PIN comparison — avoids leaking match length/prefix via response timing. */
export function pinMatches(candidate: string): boolean {
  const expected = Buffer.from(config.accessPin);
  const given = Buffer.from(candidate);
  if (expected.length === 0) return false; // no PIN configured — never "matches"
  if (expected.length !== given.length) {
    // Still do a comparison of equal-length buffers so the failure path takes comparable time.
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(expected, given);
}

function sign(payload: string): string {
  return createHmac("sha256", config.accessSessionSecret).update(payload).digest("hex");
}

/** Builds a `expiry.signature` token. Stateless — no server-side session store to invalidate,
 *  which is an accepted trade-off for a demo gate (logout just drops the cookie client-side). */
export function issueToken(now: number = Date.now()): string {
  const expiry = String(now + SESSION_TTL_MS);
  return `${expiry}.${sign(expiry)}`;
}

export function isValidToken(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false;
  const [expiry, signature] = token.split(".");
  if (!expiry || !signature) return false;
  const expected = sign(expiry);
  if (expected.length !== signature.length) return false;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false;
  const expiryMs = Number(expiry);
  return Number.isFinite(expiryMs) && expiryMs > now;
}
