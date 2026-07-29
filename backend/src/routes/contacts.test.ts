import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidPhone } from "./contacts.js";

test("isValidPhone accepts a plain digit string in range", () => {
  assert.equal(isValidPhone("15551234567"), true);
});

test("isValidPhone accepts the shortest plausible number (6 digits)", () => {
  assert.equal(isValidPhone("123456"), true);
});

test("isValidPhone rejects a too-short number", () => {
  assert.equal(isValidPhone("12345"), false);
});

test("isValidPhone rejects a too-long number", () => {
  assert.equal(isValidPhone("1234567890123456"), false);
});

test("isValidPhone rejects non-digit characters", () => {
  assert.equal(isValidPhone("+1 555-123"), false);
});

test("isValidPhone rejects non-string input", () => {
  assert.equal(isValidPhone(null), false);
  assert.equal(isValidPhone(undefined), false);
  assert.equal(isValidPhone(123456), false);
});
