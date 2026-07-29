import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSend,
  recordSendAttempt,
  typingDurationMs,
  __resetSendGuardForTests,
} from "./send-guard.js";
import { circuitBreaker } from "./circuit-breaker.js";
import { guardConfig } from "./config.js";

const SESSION = "default";
// Push the boot marker well into the past so tests exercise steady-state limits, not the
// (deliberately stricter) warm-up ones — warm-up itself gets its own dedicated test below.
const PAST_BOOT = Date.now() - guardConfig.warmupPeriodMs - 60_000;

beforeEach(() => {
  __resetSendGuardForTests(PAST_BOOT);
});

test("allows a first send to a fresh chat", () => {
  const decision = evaluateSend("chat-1", "hey there", SESSION);
  assert.equal(decision.allow, true);
  assert.ok(decision.delayMs >= guardConfig.jitterMinMs);
  assert.ok(decision.delayMs <= guardConfig.jitterMaxMs);
});

test("blocks once the per-chat per-minute limit is hit", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.perChatMaxPerMinute; i++) {
    recordSendAttempt("chat-1", `msg ${i}`, SESSION, now);
  }
  const decision = evaluateSend("chat-1", "one too many", SESSION, now);
  assert.equal(decision.allow, false);
  assert.match(decision.reason, /per-chat-limit-per-minute/);
});

test("per-chat limit does not affect a different chat", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.perChatMaxPerMinute; i++) {
    recordSendAttempt("chat-1", `msg ${i}`, SESSION, now);
  }
  const decision = evaluateSend("chat-2", "hello", SESSION, now);
  assert.equal(decision.allow, true);
});

test("blocks once the global per-minute limit is hit across many chats", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.globalMaxPerMinute; i++) {
    recordSendAttempt(`chat-${i}`, `msg ${i}`, SESSION, now);
  }
  const decision = evaluateSend("chat-new", "hello", SESSION, now);
  assert.equal(decision.allow, false);
  assert.match(decision.reason, /global-limit-per-minute/);
});

test("blocks sending to too many distinct chats in a short window (burst signature)", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.burstChatThreshold; i++) {
    recordSendAttempt(`chat-${i}`, `unique message ${i}`, SESSION, now);
  }
  const decision = evaluateSend("chat-overflow", "unique message overflow", SESSION, now);
  assert.equal(decision.allow, false);
  assert.match(decision.reason, /burst-many-chats/);
});

test("blocks near-identical content sent to a different chat shortly after", () => {
  const now = Date.now();
  recordSendAttempt("chat-1", "Hey, are we still on for Friday?", SESSION, now);
  const decision = evaluateSend(
    "chat-2",
    "  hey,   are we still on for friday?  ",
    SESSION,
    now + 1000,
  );
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, "duplicate-content-across-chats");
});

test("does not flag the same recipient re-sending similar content to themselves", () => {
  const now = Date.now();
  recordSendAttempt("chat-1", "Hey, are we still on for Friday?", SESSION, now);
  const decision = evaluateSend("chat-1", "Hey, are we still on for Friday?", SESSION, now + 1000);
  // Not blocked by the duplicate-content rule specifically (it may still be blocked by the
  // per-chat rate limit depending on config, which is a separate, expected guard).
  assert.notEqual(decision.reason, "duplicate-content-across-chats");
});

test("applies stricter limits and larger jitter during warm-up", () => {
  __resetSendGuardForTests(Date.now()); // boot = now => still warming up
  const now = Date.now();
  const warmLimit = Math.max(
    1,
    Math.floor(guardConfig.perChatMaxPerMinute / guardConfig.warmupRateDivisor),
  );
  for (let i = 0; i < warmLimit; i++) {
    recordSendAttempt("chat-1", `msg ${i}`, SESSION, now);
  }
  const decision = evaluateSend("chat-1", "one more", SESSION, now);
  assert.equal(decision.allow, false);
  assert.match(decision.reason, /per-chat-limit-per-minute/);

  __resetSendGuardForTests(Date.now());
  const fresh = evaluateSend("chat-1", "first message", SESSION, Date.now());
  assert.ok(fresh.delayMs >= guardConfig.jitterMinMs * 2);
});

test("circuit breaker opens after repeated failures and blocks further sends", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.circuitBreakerErrorThreshold; i++) {
    circuitBreaker.recordFailure(now);
  }
  const decision = evaluateSend("chat-1", "hello", SESSION, now);
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, "circuit-breaker-open");
});

test("circuit breaker clears after the cooldown window passes", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.circuitBreakerErrorThreshold; i++) {
    circuitBreaker.recordFailure(now);
  }
  assert.equal(circuitBreaker.isOpen(now), true);
  assert.equal(circuitBreaker.isOpen(now + guardConfig.circuitBreakerCooldownMs + 1), false);
});

test("typing duration scales with message length within min/max bounds", () => {
  assert.equal(typingDurationMs(""), guardConfig.typingMinMs);
  assert.ok(typingDurationMs("a".repeat(500)) <= guardConfig.typingMaxMs);
  const short = typingDurationMs("hi");
  const long = typingDurationMs("a much longer message than the short one above by far");
  assert.ok(long >= short);
});

test("guard can be disabled entirely via config for local/self-hosted trusted use", () => {
  guardConfig.enabled = false;
  try {
    const now = Date.now();
    for (let i = 0; i < guardConfig.perChatMaxPerMinute + 5; i++) {
      recordSendAttempt("chat-1", `msg ${i}`, SESSION, now);
    }
    const decision = evaluateSend("chat-1", "still allowed", SESSION, now);
    assert.equal(decision.allow, true);
    assert.equal(decision.reason, "guard-disabled");
  } finally {
    guardConfig.enabled = true;
  }
});
