import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidProfileName, isValidProfileStatus } from "./profile.js";

test("isValidProfileName accepts a non-empty name", () => {
  assert.equal(isValidProfileName("Alex"), true);
});

test("isValidProfileName rejects empty or whitespace-only names", () => {
  assert.equal(isValidProfileName(""), false);
  assert.equal(isValidProfileName("   "), false);
});

test("isValidProfileName rejects non-string input", () => {
  assert.equal(isValidProfileName(null), false);
  assert.equal(isValidProfileName(undefined), false);
});

test("isValidProfileStatus accepts any string, including empty", () => {
  assert.equal(isValidProfileStatus("Busy"), true);
  assert.equal(isValidProfileStatus(""), true);
});

test("isValidProfileStatus rejects non-string input", () => {
  assert.equal(isValidProfileStatus(null), false);
  assert.equal(isValidProfileStatus(undefined), false);
});
