function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** All limits default to conservative ("too slow rather than banned") values — tune via env,
 *  never by editing this file per-deploy. See README "Anti-detection guard" for the reasoning
 *  behind each knob. */
export const guardConfig = {
  enabled: process.env.GUARD_ENABLED !== "false",

  // Per-chat and global send-rate ceilings (sliding windows).
  perChatMaxPerMinute: num("GUARD_CHAT_MSGS_PER_MIN", 3),
  perChatMaxPerHour: num("GUARD_CHAT_MSGS_PER_HOUR", 20),
  globalMaxPerMinute: num("GUARD_GLOBAL_MSGS_PER_MIN", 8),
  globalMaxPerHour: num("GUARD_GLOBAL_MSGS_PER_HOUR", 80),

  // Jitter applied before every send so cadence never looks perfectly periodic.
  jitterMinMs: num("GUARD_JITTER_MIN_MS", 800),
  jitterMaxMs: num("GUARD_JITTER_MAX_MS", 4000),

  // Typing-indicator simulation duration, proportional to message length.
  typingMsPerChar: num("GUARD_TYPING_MS_PER_CHAR", 45),
  typingMinMs: num("GUARD_TYPING_MIN_MS", 900),
  typingMaxMs: num("GUARD_TYPING_MAX_MS", 8000),

  // Burst-to-many-distinct-chats detection (spam/broadcast signature).
  burstChatWindowMs: num("GUARD_BURST_WINDOW_MS", 60_000),
  burstChatThreshold: num("GUARD_BURST_CHAT_THRESHOLD", 4),

  // Near-identical content sent to different chats within this window is blocked.
  duplicateContentWindowMs: num("GUARD_DUP_WINDOW_MS", 10 * 60_000),

  // Warm-up: a freshly booted backend (proxy for a freshly (re)started session) runs under
  // stricter limits for this long after boot.
  warmupPeriodMs: num("GUARD_WARMUP_MS", 30 * 60_000),
  warmupRateDivisor: num("GUARD_WARMUP_DIVISOR", 3),

  // Circuit breaker: N failures within the window opens the breaker for the cooldown period,
  // blocking every WAHA call (reads included) until it clears.
  circuitBreakerErrorThreshold: num("GUARD_BREAKER_ERR_THRESHOLD", 3),
  circuitBreakerWindowMs: num("GUARD_BREAKER_WINDOW_MS", 5 * 60_000),
  circuitBreakerCooldownMs: num("GUARD_BREAKER_COOLDOWN_MS", 15 * 60_000),

  auditLogMaxEntries: num("GUARD_AUDIT_LOG_MAX", 500),
};
