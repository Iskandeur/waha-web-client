import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidAdminsOnly,
  isValidGroupDescription,
  isValidGroupName,
  isValidInviteCode,
  isValidParticipantIds,
} from "./groups.js";

test("isValidGroupName accepts a non-empty name", () => {
  assert.equal(isValidGroupName("Team lunch"), true);
});

test("isValidGroupName rejects empty or whitespace-only names", () => {
  assert.equal(isValidGroupName(""), false);
  assert.equal(isValidGroupName("   "), false);
});

test("isValidGroupName rejects non-string input", () => {
  assert.equal(isValidGroupName(null), false);
  assert.equal(isValidGroupName(undefined), false);
  assert.equal(isValidGroupName(42), false);
});

test("isValidGroupDescription accepts any string, including empty (clears the description)", () => {
  assert.equal(isValidGroupDescription("Weekly sync"), true);
  assert.equal(isValidGroupDescription(""), true);
});

test("isValidGroupDescription rejects non-string input", () => {
  assert.equal(isValidGroupDescription(null), false);
  assert.equal(isValidGroupDescription(undefined), false);
});

test("isValidParticipantIds accepts a non-empty array of non-empty strings", () => {
  assert.equal(isValidParticipantIds(["1@c.us", "2@c.us"]), true);
});

test("isValidParticipantIds rejects an empty array", () => {
  assert.equal(isValidParticipantIds([]), false);
});

test("isValidParticipantIds rejects a non-array or entries that aren't non-empty strings", () => {
  assert.equal(isValidParticipantIds("1@c.us"), false);
  assert.equal(isValidParticipantIds(null), false);
  assert.equal(isValidParticipantIds([1, 2]), false);
  assert.equal(isValidParticipantIds(["1@c.us", ""]), false);
  assert.equal(isValidParticipantIds(["1@c.us", "   "]), false);
});

test("isValidAdminsOnly accepts booleans only", () => {
  assert.equal(isValidAdminsOnly(true), true);
  assert.equal(isValidAdminsOnly(false), true);
  assert.equal(isValidAdminsOnly("true"), false);
  assert.equal(isValidAdminsOnly(undefined), false);
});

test("isValidInviteCode accepts a non-empty code", () => {
  assert.equal(isValidInviteCode("abc123"), true);
});

test("isValidInviteCode rejects empty or non-string input", () => {
  assert.equal(isValidInviteCode(""), false);
  assert.equal(isValidInviteCode(undefined), false);
  assert.equal(isValidInviteCode(null), false);
});
