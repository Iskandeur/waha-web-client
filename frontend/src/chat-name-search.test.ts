import assert from "node:assert/strict";
import test from "node:test";

import { chatNameMatches } from "./chat-name-search.js";

test("chatNameMatches handles missing WAHA chat names without throwing", () => {
  assert.equal(chatNameMatches(null, "hello"), false);
  assert.equal(chatNameMatches(undefined, "hello"), false);
});

test("chatNameMatches filters names case-insensitively and preserves empty-query listings", () => {
  assert.equal(chatNameMatches("Hello World", "hello"), true);
  assert.equal(chatNameMatches("Hello World", "absent"), false);
  assert.equal(chatNameMatches(null, ""), true);
});
