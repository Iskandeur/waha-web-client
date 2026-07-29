import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidFile } from "./chats.js";

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
