import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { isValidSearchQuery, searchRoutes } from "./search.js";
import { createMessageIndex, type IndexSource } from "../search/message-index.js";
import type { WahaChat, WahaMessage } from "../waha-client.js";

test("isValidSearchQuery rejects queries shorter than the minimum", () => {
  assert.equal(isValidSearchQuery("pizza"), true);
  assert.equal(isValidSearchQuery("ab"), true);
  assert.equal(isValidSearchQuery("a"), false);
  assert.equal(isValidSearchQuery("  "), false);
  assert.equal(isValidSearchQuery(undefined), false);
  assert.equal(isValidSearchQuery(42), false);
});

/** An index over fixed data — the route is what's under test here, not WAHA paging. */
function buildTestApp() {
  const source: IndexSource = {
    listChats: async () =>
      [
        { id: "a@c.us", name: "Alex" },
        { id: "b@c.us", name: "Sam" },
      ] as WahaChat[],
    getMessages: async (chatId, _limit, offset) => {
      if (offset > 0) return [];
      const bodies: Record<string, string[]> = {
        "a@c.us": ["pizza tonight?", "see you at the crêperie"],
        "b@c.us": ["no pizza for me thanks"],
      };
      return (bodies[chatId] ?? []).map((body, i) => ({
        id: `${chatId}-${i}`,
        timestamp: 1000 + i,
        from: chatId,
        fromMe: false,
        body,
      })) as WahaMessage[];
    },
  };
  const app = Fastify();
  return { app, register: app.register(searchRoutes(createMessageIndex(source, { pauseMs: 0 }))) };
}

test("GET /api/search returns hits with snippets and highlight offsets", async () => {
  const { app } = buildTestApp();
  const res = await app.inject({ method: "GET", url: "/api/search?q=pizza" });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.results.length, 2);
  assert.deepEqual(body.terms, ["pizza"]);
  for (const hit of body.results) {
    const { start, length } = hit.highlights[0];
    assert.equal(hit.snippet.slice(start, start + length).toLowerCase(), "pizza");
  }
  await app.close();
});

test("GET /api/search matches through accents (crêperie found by 'creperie')", async () => {
  const { app } = buildTestApp();
  const res = await app.inject({ method: "GET", url: "/api/search?q=creperie" });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.results.length, 1);
  assert.match(body.results[0].snippet, /crêperie/);
  await app.close();
});

test("GET /api/search?chatId scopes the search to one chat", async () => {
  const { app } = buildTestApp();
  const res = await app.inject({ method: "GET", url: "/api/search?q=pizza&chatId=b%40c.us" });
  const body = res.json();
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].chatId, "b@c.us");
  await app.close();
});

test("GET /api/search rejects a too-short query with 400", async () => {
  const { app } = buildTestApp();
  const res = await app.inject({ method: "GET", url: "/api/search?q=a" });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("GET /api/search rejects a nonsense limit with 400", async () => {
  const { app } = buildTestApp();
  const res = await app.inject({ method: "GET", url: "/api/search?q=pizza&limit=nope" });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("GET /api/search reports index stats alongside the results", async () => {
  const { app } = buildTestApp();
  const body = (await app.inject({ method: "GET", url: "/api/search?q=pizza" })).json();
  assert.equal(body.stats.chats, 2);
  assert.equal(body.stats.messages, 3);
  assert.equal(body.stats.matches, 2);
  assert.equal(typeof body.stats.buildMs, "number");
  await app.close();
});
