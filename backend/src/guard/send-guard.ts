import { guardConfig } from "./config.js";
import { SlidingWindowCounter } from "./rate-limiter.js";
import { circuitBreaker } from "./circuit-breaker.js";

const perChatCounter = new SlidingWindowCounter();
const globalCounter = new SlidingWindowCounter();

interface RecentSend {
  chatId: string;
  text: string;
  ts: number;
}

let recentSends: RecentSend[] = [];
let bootTs = Date.now();

export interface SendGuardDecision {
  allow: boolean;
  delayMs: number;
  reason: string;
}

function isWarmingUp(now: number): boolean {
  return now - bootTs < guardConfig.warmupPeriodMs;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function pruneRecentSends(now: number): void {
  const horizon = Math.max(guardConfig.burstChatWindowMs, guardConfig.duplicateContentWindowMs);
  recentSends = recentSends.filter((s) => now - s.ts <= horizon);
}

/** Decides whether a send should be allowed outright, allowed after a jittered delay, or
 *  blocked — and why. Pure decision logic: does not perform I/O and does not mutate state
 *  (see `recordSendAttempt`), so it's cheap to call speculatively and easy to unit test. */
export function evaluateSend(
  chatId: string,
  text: string,
  session: string,
  now: number = Date.now(),
): SendGuardDecision {
  if (!guardConfig.enabled) return { allow: true, delayMs: 0, reason: "guard-disabled" };

  if (circuitBreaker.isOpen(now)) {
    return { allow: false, delayMs: 0, reason: "circuit-breaker-open" };
  }

  const warmup = isWarmingUp(now);
  const divisor = warmup ? guardConfig.warmupRateDivisor : 1;
  const chatMinuteLimit = Math.max(1, Math.floor(guardConfig.perChatMaxPerMinute / divisor));
  const chatHourLimit = Math.max(1, Math.floor(guardConfig.perChatMaxPerHour / divisor));
  const globalMinuteLimit = Math.max(1, Math.floor(guardConfig.globalMaxPerMinute / divisor));
  const globalHourLimit = Math.max(1, Math.floor(guardConfig.globalMaxPerHour / divisor));

  const chatKey = `${session}:${chatId}`;
  if (perChatCounter.count(chatKey, now, 60_000) >= chatMinuteLimit) {
    return { allow: false, delayMs: 0, reason: `per-chat-limit-per-minute(${chatMinuteLimit})` };
  }
  if (perChatCounter.count(chatKey, now, 3_600_000) >= chatHourLimit) {
    return { allow: false, delayMs: 0, reason: `per-chat-limit-per-hour(${chatHourLimit})` };
  }

  const globalKey = session;
  if (globalCounter.count(globalKey, now, 60_000) >= globalMinuteLimit) {
    return { allow: false, delayMs: 0, reason: `global-limit-per-minute(${globalMinuteLimit})` };
  }
  if (globalCounter.count(globalKey, now, 3_600_000) >= globalHourLimit) {
    return { allow: false, delayMs: 0, reason: `global-limit-per-hour(${globalHourLimit})` };
  }

  pruneRecentSends(now);

  const distinctRecentChats = new Set(
    recentSends.filter((s) => now - s.ts < guardConfig.burstChatWindowMs).map((s) => s.chatId),
  );
  distinctRecentChats.add(chatId);
  if (distinctRecentChats.size > guardConfig.burstChatThreshold) {
    return {
      allow: false,
      delayMs: 0,
      reason: `burst-many-chats(${distinctRecentChats.size}>${guardConfig.burstChatThreshold})`,
    };
  }

  const norm = normalize(text);
  if (norm.length > 0) {
    const dupCutoff = now - guardConfig.duplicateContentWindowMs;
    const duplicate = recentSends.find(
      (s) => s.ts >= dupCutoff && s.chatId !== chatId && normalize(s.text) === norm,
    );
    if (duplicate) {
      return { allow: false, delayMs: 0, reason: "duplicate-content-across-chats" };
    }
  }

  const jitterMin = warmup ? guardConfig.jitterMinMs * 2 : guardConfig.jitterMinMs;
  const jitterMax = warmup ? guardConfig.jitterMaxMs * 2 : guardConfig.jitterMaxMs;
  const delayMs = jitterMin + Math.floor(Math.random() * Math.max(1, jitterMax - jitterMin));

  return { allow: true, delayMs, reason: warmup ? "allowed-warmup" : "allowed" };
}

/** Must be called once a send has been decided `allow: true` and is actually going out —
 *  feeds the rate-limit windows and the duplicate/burst-content history. */
export function recordSendAttempt(
  chatId: string,
  text: string,
  session: string,
  now: number = Date.now(),
): void {
  perChatCounter.record(`${session}:${chatId}`, now);
  globalCounter.record(session, now);
  recentSends.push({ chatId, text, ts: now });
  pruneRecentSends(now);
}

/** Typing-indicator duration for a message of this length — never instant, never a fixed
 *  constant (that would itself be a periodicity signal), clamped to a sane range. */
export function typingDurationMs(text: string): number {
  const raw = text.length * guardConfig.typingMsPerChar;
  return Math.min(guardConfig.typingMaxMs, Math.max(guardConfig.typingMinMs, raw));
}

export function sendGuardStatus(now: number = Date.now()) {
  return {
    warmingUp: isWarmingUp(now),
    warmupEndsAt: bootTs + guardConfig.warmupPeriodMs,
    circuitBreaker: circuitBreaker.status(now),
  };
}

/** Test-only: resets in-memory state so test cases don't leak into each other, and lets a
 *  test simulate "backend has been up for a while" by shifting the boot marker. */
export function __resetSendGuardForTests(newBootTs: number = Date.now()): void {
  perChatCounter.clear();
  globalCounter.clear();
  recentSends = [];
  bootTs = newBootTs;
  circuitBreaker.reset();
}
