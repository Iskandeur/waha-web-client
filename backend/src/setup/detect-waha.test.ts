import { test } from "node:test";
import assert from "node:assert/strict";
import { probeWaha, decideWahaSetup } from "./detect-waha.js";

function fakeFetch(handler: (signal: AbortSignal) => Promise<Response>): typeof fetch {
  return ((_url: string, opts?: { signal?: AbortSignal }) =>
    handler(opts?.signal ?? new AbortController().signal)) as typeof fetch;
}

test("found: 200 with a version field", async () => {
  const fetchImpl = fakeFetch(async () => Response.json({ version: { number: "2024.1.1" } }));
  const result = await probeWaha("http://localhost:3000", fetchImpl);
  assert.deepEqual(result, { found: true, status: 200, reason: "waha-version-endpoint" });
});

test("found: 401 (API key required) is still a positive signal", async () => {
  const fetchImpl = fakeFetch(async () => new Response("Unauthorized", { status: 401 }));
  const result = await probeWaha("http://localhost:3000", fetchImpl);
  assert.equal(result.found, true);
  assert.equal(result.reason, "waha-auth-required");
});

test("found: 403 is also a positive signal", async () => {
  const fetchImpl = fakeFetch(async () => new Response("Forbidden", { status: 403 }));
  const result = await probeWaha("http://localhost:3000", fetchImpl);
  assert.equal(result.found, true);
});

test("not found: 200 but body has no version field (some other HTTP service)", async () => {
  const fetchImpl = fakeFetch(async () => Response.json({ hello: "world" }));
  const result = await probeWaha("http://localhost:3000", fetchImpl);
  assert.equal(result.found, false);
  assert.equal(result.reason, "responded-but-not-waha-shaped");
});

test("not found: 404", async () => {
  const fetchImpl = fakeFetch(async () => new Response("not found", { status: 404 }));
  const result = await probeWaha("http://localhost:3000", fetchImpl);
  assert.equal(result.found, false);
  assert.equal(result.reason, "unexpected-status-404");
});

test("not found: connection refused", async () => {
  const fetchImpl = fakeFetch(async () => {
    throw new Error("connect ECONNREFUSED");
  });
  const result = await probeWaha("http://localhost:3000", fetchImpl);
  assert.deepEqual(result, { found: false, reason: "connection-failed" });
});

test("not found: times out", async () => {
  const fetchImpl = fakeFetch(
    (signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  const result = await probeWaha("http://localhost:3000", fetchImpl, 20);
  assert.deepEqual(result, { found: false, reason: "timeout" });
});

test("decideWahaSetup: a deliberately configured URL always wins, even if something else is found", () => {
  const choice = decideWahaSetup("http://elsewhere:9000", "http://localhost:3000", {
    found: true,
    status: 200,
    reason: "waha-version-endpoint",
  });
  assert.deepEqual(choice, { kind: "use-configured", baseUrl: "http://elsewhere:9000" });
});

test("decideWahaSetup: unset + found -> use-detected", () => {
  const probe = { found: true, status: 200, reason: "waha-version-endpoint" } as const;
  const choice = decideWahaSetup(undefined, "http://localhost:3000", probe);
  assert.deepEqual(choice, { kind: "use-detected", baseUrl: "http://localhost:3000", probe });
});

test("decideWahaSetup: unset + not found -> start-bundled", () => {
  const choice = decideWahaSetup(undefined, "http://localhost:3000", {
    found: false,
    reason: "connection-failed",
  });
  assert.deepEqual(choice, { kind: "start-bundled" });
});
