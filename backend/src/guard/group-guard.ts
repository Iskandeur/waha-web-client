import { guardConfig } from "./config.js";
import { SlidingWindowCounter } from "./rate-limiter.js";
import { circuitBreaker } from "./circuit-breaker.js";

const perGroupCounter = new SlidingWindowCounter();
const globalCounter = new SlidingWindowCounter();

export interface GroupActionGuardDecision {
  allow: boolean;
  delayMs: number;
  reason: string;
}

/** Add/remove/promote/demote are bulk membership mutations — the same abuse-detection
 *  signature (many accounts touched, fast, scriptable) that `send-guard` exists to slow down
 *  for messages, just on a different axis (participants-per-call, actions-per-group,
 *  actions-per-session) instead of chat/content. Deliberately separate from `evaluateSend`:
 *  the shapes don't overlap (no chatId/text here) and mixing them would make both harder to
 *  reason about. */
export function evaluateGroupAction(
  groupId: string,
  participantCount: number,
  session: string,
  now: number = Date.now(),
): GroupActionGuardDecision {
  if (!guardConfig.enabled) return { allow: true, delayMs: 0, reason: "guard-disabled" };

  if (circuitBreaker.isOpen(now)) {
    return { allow: false, delayMs: 0, reason: "circuit-breaker-open" };
  }

  if (participantCount > guardConfig.groupActionMaxParticipantsPerCall) {
    return {
      allow: false,
      delayMs: 0,
      reason: `too-many-participants-per-call(${participantCount}>${guardConfig.groupActionMaxParticipantsPerCall})`,
    };
  }

  const groupKey = `${session}:${groupId}`;
  if (perGroupCounter.count(groupKey, now, 60_000) >= guardConfig.groupActionMaxPerGroupPerMinute) {
    return {
      allow: false,
      delayMs: 0,
      reason: `per-group-limit-per-minute(${guardConfig.groupActionMaxPerGroupPerMinute})`,
    };
  }

  const globalKey = session;
  if (globalCounter.count(globalKey, now, 60_000) >= guardConfig.groupActionMaxGlobalPerMinute) {
    return {
      allow: false,
      delayMs: 0,
      reason: `global-limit-per-minute(${guardConfig.groupActionMaxGlobalPerMinute})`,
    };
  }
  if (globalCounter.count(globalKey, now, 3_600_000) >= guardConfig.groupActionMaxGlobalPerHour) {
    return {
      allow: false,
      delayMs: 0,
      reason: `global-limit-per-hour(${guardConfig.groupActionMaxGlobalPerHour})`,
    };
  }

  const delayMs =
    guardConfig.jitterMinMs +
    Math.floor(Math.random() * Math.max(1, guardConfig.jitterMaxMs - guardConfig.jitterMinMs));

  return { allow: true, delayMs, reason: "allowed" };
}

export function recordGroupAction(groupId: string, session: string, now: number = Date.now()): void {
  perGroupCounter.record(`${session}:${groupId}`, now);
  globalCounter.record(session, now);
}

/** Test-only: resets in-memory state so test cases don't leak into each other. */
export function __resetGroupGuardForTests(): void {
  perGroupCounter.clear();
  globalCounter.clear();
}
