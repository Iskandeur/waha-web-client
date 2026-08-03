import assert from "node:assert/strict";
import test from "node:test";

import { countsTowardCircuitBreaker } from "./waha-client.js";

test("caller-owned aborts do not count as WAHA circuit-breaker failures", () => {
  const controller = new AbortController();

  assert.equal(countsTowardCircuitBreaker(controller.signal), true);
  controller.abort();
  assert.equal(countsTowardCircuitBreaker(controller.signal), false);
});

test("requests without an aborted signal still count as WAHA failures", () => {
  assert.equal(countsTowardCircuitBreaker(), true);
  assert.equal(countsTowardCircuitBreaker(null), true);
});
