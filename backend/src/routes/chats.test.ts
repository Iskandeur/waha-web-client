import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidFile, isValidPinDuration, isValidText, PIN_DURATIONS } from "./chats.js";

test("isValidFile accepts a remote-URL file (mimetype + url)", () => {
  assert.equal(isValidFile({ mimetype: "image/jpeg", url: "https://example.com/x.jpg" }), true);
});

test("isValidFile accepts an inline base64 file (mimetype + data)", () => {
  assert.equal(isValidFile({ mimetype: "image/png", data: "aGVsbG8=" }), true);
});

test("isValidFile rejects a file with neither url nor data", () => {
  assert.equal(isValidFile({ mimetype: "image/png" }), false);
});

test("isValidFile rejects a file missing mimetype", () => {
  assert.equal(isValidFile({ url: "https://example.com/x.jpg" }), false);
});

test("isValidFile rejects non-object input", () => {
  assert.equal(isValidFile("not-a-file"), false);
  assert.equal(isValidFile(null), false);
  assert.equal(isValidFile(undefined), false);
});

test("isValidFile accepts a generic document mimetype (sendFile reuses the same shape)", () => {
  assert.equal(isValidFile({ mimetype: "application/pdf", url: "https://example.com/x.pdf" }), true);
});

test("isValidFile accepts a video mimetype (sendVideo reuses the same shape)", () => {
  assert.equal(isValidFile({ mimetype: "video/mp4", data: "aGVsbG8=" }), true);
});

test("isValidPinDuration accepts the three WhatsApp-supported durations", () => {
  for (const d of PIN_DURATIONS) {
    assert.equal(isValidPinDuration(d), true);
  }
});

test("isValidPinDuration rejects an arbitrary number of seconds", () => {
  assert.equal(isValidPinDuration(3600), false);
});

test("isValidPinDuration rejects non-number input", () => {
  assert.equal(isValidPinDuration("86400"), false);
  assert.equal(isValidPinDuration(null), false);
  assert.equal(isValidPinDuration(undefined), false);
});

test("isValidText accepts non-empty text (shared by send + edit routes)", () => {
  assert.equal(isValidText("hello"), true);
});

test("isValidText rejects empty or whitespace-only text", () => {
  assert.equal(isValidText(""), false);
  assert.equal(isValidText("   "), false);
});

test("isValidText rejects non-string input", () => {
  assert.equal(isValidText(null), false);
  assert.equal(isValidText(undefined), false);
  assert.equal(isValidText(42), false);
});
