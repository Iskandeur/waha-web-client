import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSafeBind, isLoopbackHost } from "./bind-guard.js";

test("isLoopbackHost accepts 127.0.0.1, localhost, ::1", () => {
  assert.equal(isLoopbackHost("127.0.0.1"), true);
  assert.equal(isLoopbackHost("localhost"), true);
  assert.equal(isLoopbackHost("::1"), true);
});

test("isLoopbackHost rejects 0.0.0.0 and any other interface/hostname", () => {
  assert.equal(isLoopbackHost("0.0.0.0"), false);
  assert.equal(isLoopbackHost("::"), false);
  assert.equal(isLoopbackHost("192.168.1.10"), false);
});

test("assertSafeBind allows loopback hosts regardless of ACCESS_PIN", () => {
  assert.doesNotThrow(() => assertSafeBind("127.0.0.1", ""));
  assert.doesNotThrow(() => assertSafeBind("localhost", ""));
  assert.doesNotThrow(() => assertSafeBind("::1", ""));
});

test("assertSafeBind refuses 0.0.0.0 without ACCESS_PIN", () => {
  assert.throws(() => assertSafeBind("0.0.0.0", ""), /ACCESS_PIN/);
});

test("assertSafeBind refuses any non-loopback host without ACCESS_PIN", () => {
  assert.throws(() => assertSafeBind("192.168.1.10", ""), /ACCESS_PIN/);
});

test("assertSafeBind allows 0.0.0.0 when ACCESS_PIN is set", () => {
  assert.doesNotThrow(() => assertSafeBind("0.0.0.0", "123456"));
});
