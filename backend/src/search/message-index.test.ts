import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSnippet,
  createMessageIndex,
  fold,
  matchRanges,
  parseQuery,
  type IndexSource,
} from "./message-index.js";
import type { WahaChat, WahaMessage } from "../waha-client.js";

test("fold: case- and accent-insensitive", () => {
  assert.equal(fold("Été À Paris"), "ete a paris");
  assert.equal(fold("CRÈME brûlée"), "creme brulee");
});

test("parseQuery: whitespace splits into AND-ed terms, quotes make a phrase", () => {
  assert.deepEqual(parseQuery("hello world"), ["hello", "world"]);
  assert.deepEqual(parseQuery('"hello world"'), ["hello world"]);
  assert.deepEqual(parseQuery('  Café  "petit déjeuner" '), ["cafe", "petit dejeuner"]);
  assert.deepEqual(parseQuery("   "), []);
});

test("matchRanges: all terms required", () => {
  assert.ok(matchRanges("dinner at eight", ["dinner", "eight"]));
  assert.equal(matchRanges("dinner at eight", ["dinner", "lunch"]), null);
  assert.equal(matchRanges("dinner at eight", []), null);
});

test("matchRanges: offsets stay aligned to the ORIGINAL string despite accents", () => {
  const body = "on va où ? à la crêperie";
  const ranges = matchRanges(body, ["creperie"]);
  assert.ok(ranges);
  const [range] = ranges;
  // The whole point: slicing the original with these offsets gives the accented word back.
  assert.equal(body.slice(range.start, range.start + range.length), "crêperie");
});

test("matchRanges: every occurrence of a term is highlighted, in order", () => {
  const ranges = matchRanges("test one test two", ["test"]);
  assert.deepEqual(ranges, [
    { start: 0, length: 4 },
    { start: 9, length: 4 },
  ]);
});

test("buildSnippet: windows around the first match and rebases the highlights", () => {
  const body = `${"a".repeat(200)} needle ${"b".repeat(200)}`;
  const ranges = matchRanges(body, ["needle"]);
  assert.ok(ranges);
  const { snippet, highlights } = buildSnippet(body, ranges, 20);
  assert.ok(snippet.startsWith("…"));
  assert.ok(snippet.endsWith("…"));
  assert.ok(snippet.length < body.length);
  assert.equal(snippet.slice(highlights[0].start, highlights[0].start + highlights[0].length), "needle");
});

test("buildSnippet: short bodies are returned whole, without ellipses", () => {
  const body = "dinner at eight";
  const ranges = matchRanges(body, ["dinner"]);
  assert.ok(ranges);
  const { snippet, highlights } = buildSnippet(body, ranges, 70);
  assert.equal(snippet, body);
  assert.deepEqual(highlights, [{ start: 0, length: 6 }]);
});

// --- index behaviour ---------------------------------------------------------------------

function fakeSource(
  chats: Array<{ id: string; name?: string; messages: string[] }>,
  onCall?: (chatId: string, offset: number) => void,
): IndexSource & { calls: number } {
  const source = {
    calls: 0,
    async listChats(): Promise<WahaChat[]> {
      return chats.map((c) => ({ id: c.id, name: c.name })) as WahaChat[];
    },
    async getMessages(chatId: string, limit: number, offset: number): Promise<WahaMessage[]> {
      source.calls++;
      onCall?.(chatId, offset);
      const chat = chats.find((c) => c.id === chatId);
      if (!chat) return [];
      return chat.messages.slice(offset, offset + limit).map((body, i) => ({
        id: `${chatId}-${offset + i}`,
        timestamp: 1000 + offset + i,
        from: chatId,
        fromMe: i % 2 === 0,
        body,
      }));
    },
  };
  return source;
}

const FAST = { pauseMs: 0, pageSize: 10, pagesPerChat: 2 };

test("search: finds a message across chats, newest first", async () => {
  const index = createMessageIndex(
    fakeSource([
      { id: "a@c.us", name: "Alex", messages: ["pizza tonight?", "sure"] },
      { id: "b@c.us", name: "Sam", messages: ["no pizza for me"] },
    ]),
    FAST,
  );
  const res = await index.search("pizza");
  assert.equal(res.results.length, 2);
  assert.ok(res.results[0].timestamp >= res.results[1].timestamp);
  assert.deepEqual(
    res.results.map((r) => r.chatName).sort(),
    ["Alex", "Sam"],
  );
  assert.equal(res.stats.matches, 2);
});

test("search: chatId scopes results to one conversation", async () => {
  const index = createMessageIndex(
    fakeSource([
      { id: "a@c.us", name: "Alex", messages: ["pizza tonight?"] },
      { id: "b@c.us", name: "Sam", messages: ["no pizza for me"] },
    ]),
    FAST,
  );
  const res = await index.search("pizza", { chatId: "b@c.us" });
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].chatId, "b@c.us");
});

test("search: an empty query never triggers a build", async () => {
  const source = fakeSource([{ id: "a@c.us", messages: ["hello"] }]);
  const index = createMessageIndex(source, FAST);
  const res = await index.search("   ");
  assert.deepEqual(res.results, []);
  assert.equal(source.calls, 0);
});

test("index: reused within the TTL, rebuilt after it, forced by refresh", async () => {
  let clock = 0;
  const source = fakeSource([{ id: "a@c.us", messages: ["hello"] }]);
  const index = createMessageIndex(source, {
    ...FAST,
    ttlMs: 1000,
    now: () => clock,
    sleep: async () => undefined,
  });

  await index.search("hello");
  const afterFirst = source.calls;
  assert.ok(afterFirst > 0);

  clock = 500;
  await index.search("hello");
  assert.equal(source.calls, afterFirst, "within TTL: no refetch");

  await index.search("hello", { refresh: true });
  assert.ok(source.calls > afterFirst, "refresh: refetched");

  const afterRefresh = source.calls;
  clock = 5000;
  await index.search("hello");
  assert.ok(source.calls > afterRefresh, "past TTL: refetched");
});

test("index: concurrent searches share a single build", async () => {
  const source = fakeSource([{ id: "a@c.us", messages: ["hello"] }]);
  const index = createMessageIndex(source, FAST);
  await Promise.all([index.search("hello"), index.search("hello"), index.search("hello")]);
  assert.equal(source.calls, 1, "one page fetched once, not three times");
});

test("index: stops paging a chat once a short page comes back", async () => {
  const offsets: number[] = [];
  const source = fakeSource(
    [{ id: "a@c.us", messages: ["one", "two"] }],
    (_chatId, offset) => offsets.push(offset),
  );
  const index = createMessageIndex(source, { ...FAST, pagesPerChat: 5 });
  await index.search("one");
  assert.deepEqual(offsets, [0], "short first page ends the walk");
});

test("index: spaces WAHA reads across chats, including short one-page histories", async () => {
  const events: string[] = [];
  const source = fakeSource(
    [
      { id: "a@c.us", messages: ["one"] },
      { id: "b@c.us", messages: ["two"] },
      { id: "c@c.us", messages: ["three"] },
    ],
    (chatId) => events.push(`fetch:${chatId}`),
  );
  const index = createMessageIndex(source, {
    ...FAST,
    pauseMs: 120,
    sleep: async (ms) => events.push(`sleep:${ms}`),
  });
  await index.search("one");
  assert.deepEqual(events, [
    "fetch:a@c.us",
    "sleep:120",
    "fetch:b@c.us",
    "sleep:120",
    "fetch:c@c.us",
  ]);
});

test("index: caps the number of chats and reports the result as partial", async () => {
  const chats = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}@c.us`,
    messages: ["shared word"],
  }));
  const index = createMessageIndex(fakeSource(chats), { ...FAST, maxChats: 2 });
  const res = await index.search("shared");
  assert.equal(res.results.length, 2);
  assert.equal(res.stats.chats, 2);
  assert.equal(res.stats.partial, true);
});

test("index: one failing chat is skipped, the rest still searchable", async () => {
  const good = fakeSource([
    { id: "ok@c.us", name: "Ok", messages: ["findable"] },
    { id: "bad@c.us", name: "Bad", messages: ["findable"] },
  ]);
  const source: IndexSource = {
    listChats: good.listChats,
    getMessages: (chatId, limit, offset) =>
      chatId === "bad@c.us"
        ? Promise.reject(new Error("waha exploded"))
        : good.getMessages(chatId, limit, offset),
  };
  const index = createMessageIndex(source, FAST);
  const res = await index.search("findable");
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].chatId, "ok@c.us");
  assert.equal(res.stats.skippedChats, 1);
});

test("index: a chat failing on a later page leaves no partial messages behind", async () => {
  const source: IndexSource = {
    listChats: async () => [
      { id: "good@c.us", name: "Good" },
      { id: "partial@c.us", name: "Partial" },
    ] as WahaChat[],
    getMessages: async (chatId, limit, offset) => {
      if (chatId === "partial@c.us" && offset > 0) throw new Error("second page failed");
      const count = offset === 0 ? limit : 1;
      return Array.from({ length: count }, (_, i) => ({
        id: `${chatId}-${offset + i}`,
        timestamp: offset + i,
        from: chatId,
        fromMe: false,
        body: chatId === "partial@c.us" ? "partial-only needle" : "good needle",
      })) as WahaMessage[];
    },
  };
  const index = createMessageIndex(source, FAST);
  const res = await index.search("needle");
  assert.equal(res.results.length, 11);
  assert.ok(res.results.every((hit) => hit.chatId === "good@c.us"));
  assert.equal(res.stats.skippedChats, 1);
  assert.equal(res.stats.messages, 11);
});

test("index: when EVERY chat fails, the error surfaces instead of a silent empty result", async () => {
  const source: IndexSource = {
    listChats: async () => [{ id: "a@c.us" }] as WahaChat[],
    getMessages: () => Promise.reject(new Error("blocked-by-guard")),
  };
  const index = createMessageIndex(source, FAST);
  await assert.rejects(() => index.search("anything"), /blocked-by-guard/);
});

test("search: results are capped by limit", async () => {
  const messages = Array.from({ length: 10 }, (_, i) => `hit number ${i}`);
  const index = createMessageIndex(fakeSource([{ id: "a@c.us", messages }]), FAST);
  const res = await index.search("hit", { limit: 3 });
  assert.equal(res.results.length, 3);
  assert.equal(res.stats.matches, 10, "the cap trims the page, not the reported total");
});
