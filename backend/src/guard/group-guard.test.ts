import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGroupAction,
  recordGroupAction,
  __resetGroupGuardForTests,
} from "./group-guard.js";
import { circuitBreaker } from "./circuit-breaker.js";
import { guardConfig } from "./config.js";

const SESSION = "default";

beforeEach(() => {
  __resetGroupGuardForTests();
  circuitBreaker.reset();
});

test("allows a first group action within the participant-count cap", () => {
  const decision = evaluateGroupAction("g1@g.us", 3, SESSION);
  assert.equal(decision.allow, true);
  assert.ok(decision.delayMs >= guardConfig.jitterMinMs);
});

test("blocks a single call touching too many participants at once", () => {
  const decision = evaluateGroupAction(
    "g1@g.us",
    guardConfig.groupActionMaxParticipantsPerCall + 1,
    SESSION,
  );
  assert.equal(decision.allow, false);
  assert.match(decision.reason, /too-many-participants-per-call/);
});

test("blocks once the per-group per-minute limit is hit", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.groupActionMaxPerGroupPerMinute; i++) {
    recordGroupAction("g1@g.us", SESSION, now);
  }
  const decision = evaluateGroupAction("g1@g.us", 1, SESSION, now);
  assert.equal(decision.allow, false);
  assert.match(decision.reason, /per-group-limit-per-minute/);
});

test("per-group limit does not affect a different group", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.groupActionMaxPerGroupPerMinute; i++) {
    recordGroupAction("g1@g.us", SESSION, now);
  }
  const decision = evaluateGroupAction("g2@g.us", 1, SESSION, now);
  assert.equal(decision.allow, true);
});

test("blocks once the global per-minute limit is hit across many groups", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.groupActionMaxGlobalPerMinute; i++) {
    recordGroupAction(`g${i}@g.us`, SESSION, now);
  }
  const decision = evaluateGroupAction("g-new@g.us", 1, SESSION, now);
  assert.equal(decision.allow, false);
  assert.match(decision.reason, /global-limit-per-minute/);
});

test("circuit breaker blocks group actions too", () => {
  const now = Date.now();
  for (let i = 0; i < guardConfig.circuitBreakerErrorThreshold; i++) {
    circuitBreaker.recordFailure(now);
  }
  const decision = evaluateGroupAction("g1@g.us", 1, SESSION, now);
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, "circuit-breaker-open");
});

test("guard can be disabled entirely via config", () => {
  guardConfig.enabled = false;
  try {
    const decision = evaluateGroupAction("g1@g.us", 999, SESSION);
    assert.equal(decision.allow, true);
    assert.equal(decision.reason, "guard-disabled");
  } finally {
    guardConfig.enabled = true;
  }
});
