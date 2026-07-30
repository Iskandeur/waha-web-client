import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./app.js";
import { config } from "./config.js";

const originalRealConnection = { ...config.realConnection };

afterEach(() => {
  config.realConnection.enabled = originalRealConnection.enabled;
  config.realConnection.allowedSession = originalRealConnection.allowedSession;
  config.realConnection.writeEnabled = originalRealConnection.writeEnabled;
});

/** Forces every non-"read" `waha.*` call to be refused by the real-connection guard (see
 *  real-connection-guard.ts) without touching WAHA or the network — same mechanism
 *  real-connection-guard.test.ts uses to drive the guard deterministically. */
function forceWriteBlocked(): void {
  config.realConnection.enabled = true;
  config.realConnection.allowedSession = config.wahaSession;
  config.realConnection.writeEnabled = false;
}

/** Every route below performs a write-kind `waha.*` call and, before this fix, either 429'd (if
 *  it had its own try/catch) or 500'd (if it didn't — the bug from job #56: markChatRead,
 *  markChatUnread, subscribePresence, and most of groups/labels/profile/contacts). The single
 *  global error handler in app.ts now makes every one of these 429 uniformly, so this table
 *  intentionally spans all five route modules rather than just the three originally reported. */
const BLOCKED_ROUTES: Array<{
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  payload?: unknown;
}> = [
  // The three routes explicitly reported as 500-instead-of-429 in job #56.
  { name: "markChatRead", method: "POST", url: "/api/chats/123@c.us/read" },
  { name: "markChatUnread", method: "POST", url: "/api/chats/123@c.us/unread" },
  {
    name: "subscribePresence",
    method: "POST",
    url: "/api/chats/123@c.us/presence/subscribe",
  },
  // sendText already had its own try/catch — kept as a regression check that the global
  // handler didn't change its (already-correct) behavior.
  {
    name: "sendText",
    method: "POST",
    url: "/api/chats/123@c.us/messages",
    payload: { text: "hi" },
  },
  // Previously-unguarded routes in the same file.
  { name: "archiveChat", method: "POST", url: "/api/chats/123@c.us/archive" },
  { name: "deleteChat", method: "DELETE", url: "/api/chats/123@c.us" },
  // groups.ts: both the one route that had a local `guarded()` helper and several that had
  // no guard handling at all.
  {
    name: "addGroupParticipants",
    method: "POST",
    url: "/api/groups/123@g.us/participants/add",
    payload: { participantIds: ["456@c.us"] },
  },
  { name: "leaveGroup", method: "POST", url: "/api/groups/123@g.us/leave" },
  {
    name: "setGroupSubject",
    method: "PUT",
    url: "/api/groups/123@g.us/subject",
    payload: { subject: "New subject" },
  },
  // labels.ts: no guard handling existed at all before this fix.
  {
    name: "createLabel",
    method: "POST",
    url: "/api/labels",
    payload: { name: "Important" },
  },
  // profile.ts: same — no guard handling existed.
  {
    name: "setProfileName",
    method: "PUT",
    url: "/api/profile/name",
    payload: { name: "New name" },
  },
  // contacts.ts: same — no guard handling existed.
  {
    name: "blockContact",
    method: "POST",
    url: "/api/contacts/block",
    payload: { contactId: "456@c.us" },
  },
];

for (const route of BLOCKED_ROUTES) {
  test(`${route.name}: guard-blocked write returns 429 with a blocked-by-guard body, not 500`, async () => {
    forceWriteBlocked();
    const app = await buildApp();
    const res = await app.inject({
      method: route.method,
      url: route.url,
      payload: route.payload,
    });
    assert.equal(res.statusCode, 429);
    const body = res.json();
    assert.equal(body.error, "blocked-by-guard");
    assert.match(body.reason, /real-connection-read-only/);
    await app.close();
  });
}

test("guard-blocked reads are unaffected (real-connection guard only blocks non-read kinds)", async () => {
  forceWriteBlocked();
  const app = await buildApp();
  const res = await app.inject({ method: "GET", url: "/api/chats" });
  assert.notEqual(res.statusCode, 429);
  await app.close();
});
