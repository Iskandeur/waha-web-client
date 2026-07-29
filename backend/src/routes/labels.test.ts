import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidLabelIds, isValidLabelName } from "./labels.js";

test("isValidLabelName accepts a non-empty name", () => {
  assert.equal(isValidLabelName("Lead"), true);
});

test("isValidLabelName rejects empty or whitespace-only names", () => {
  assert.equal(isValidLabelName(""), false);
  assert.equal(isValidLabelName("   "), false);
});

test("isValidLabelName rejects non-string input", () => {
  assert.equal(isValidLabelName(null), false);
  assert.equal(isValidLabelName(undefined), false);
  assert.equal(isValidLabelName(42), false);
});

test("isValidLabelIds accepts an array of strings (including empty)", () => {
  assert.equal(isValidLabelIds([]), true);
  assert.equal(isValidLabelIds(["1", "2"]), true);
});

test("isValidLabelIds rejects a non-array or an array with non-string entries", () => {
  assert.equal(isValidLabelIds("1"), false);
  assert.equal(isValidLabelIds(null), false);
  assert.equal(isValidLabelIds([1, 2]), false);
  assert.equal(isValidLabelIds(["1", 2]), false);
});
