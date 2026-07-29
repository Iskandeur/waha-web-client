import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { config } from "./config.js";
import { checkRealConnection } from "./real-connection-guard.js";

const original = { ...config.realConnection };

afterEach(() => {
  config.realConnection.enabled = original.enabled;
  config.realConnection.allowedSession = original.allowedSession;
  config.realConnection.writeEnabled = original.writeEnabled;
});

test("disabled (default): allows every session and kind untouched", () => {
  config.realConnection.enabled = false;
  assert.deepEqual(checkRealConnection("default", "send"), { allow: true });
  assert.deepEqual(checkRealConnection("anything", "group"), { allow: true });
});

test("enabled: blocks a session other than the allowed one, even for reads", () => {
  config.realConnection.enabled = true;
  config.realConnection.allowedSession = "lupi";
  config.realConnection.writeEnabled = true;

  const decision = checkRealConnection("default", "read");
  assert.equal(decision.allow, false);
  assert.match((decision as { reason: string }).reason, /real-connection-session-mismatch/);
});

test("enabled + allowed session + write NOT enabled: allows reads, blocks send/presence/group", () => {
  config.realConnection.enabled = true;
  config.realConnection.allowedSession = "lupi";
  config.realConnection.writeEnabled = false;

  assert.deepEqual(checkRealConnection("lupi", "read"), { allow: true });

  for (const kind of ["send", "presence", "group"] as const) {
    const decision = checkRealConnection("lupi", kind);
    assert.equal(decision.allow, false, `expected "${kind}" to be blocked`);
    assert.match((decision as { reason: string }).reason, /real-connection-read-only/);
  }
});

test("enabled + allowed session + write enabled: allows everything", () => {
  config.realConnection.enabled = true;
  config.realConnection.allowedSession = "lupi";
  config.realConnection.writeEnabled = true;

  for (const kind of ["read", "send", "presence", "group"] as const) {
    assert.deepEqual(checkRealConnection("lupi", kind), { allow: true });
  }
});

test("session mismatch is checked before the write gate (both would fail, session wins)", () => {
  config.realConnection.enabled = true;
  config.realConnection.allowedSession = "lupi";
  config.realConnection.writeEnabled = false;

  const decision = checkRealConnection("default", "send");
  assert.equal(decision.allow, false);
  assert.match((decision as { reason: string }).reason, /real-connection-session-mismatch/);
});
