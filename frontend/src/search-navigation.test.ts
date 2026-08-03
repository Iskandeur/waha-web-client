import assert from "node:assert/strict";
import test from "node:test";

import { containsMessageId } from "./search-navigation.js";

test("search highlight waits until its target message is loaded", () => {
  const messages = [{ id: "newer" }];

  assert.equal(containsMessageId(messages, "older-target"), false);
  assert.equal(containsMessageId([...messages, { id: "older-target" }], "older-target"), true);
});

test("search highlight stays inactive without a target", () => {
  assert.equal(containsMessageId([{ id: "message" }], null), false);
  assert.equal(containsMessageId([{ id: "message" }]), false);
});
