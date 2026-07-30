import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadEnvFile } from "./env-file.js";

const dirs: string[] = [];

function writeTempEnv(contents: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "wsharp-envtest-"));
  dirs.push(dir);
  const file = path.join(dir, ".env");
  writeFileSync(file, contents);
  return file;
}

afterEach(() => {
  delete process.env.ENV_FILE_TEST_A;
  delete process.env.ENV_FILE_TEST_B;
  delete process.env.ENV_FILE_TEST_C;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("loads unset keys from the file", () => {
  const file = writeTempEnv("ENV_FILE_TEST_A=hello\nENV_FILE_TEST_B=world\n");
  loadEnvFile(file);
  assert.equal(process.env.ENV_FILE_TEST_A, "hello");
  assert.equal(process.env.ENV_FILE_TEST_B, "world");
});

test("never overrides a variable already present in process.env", () => {
  process.env.ENV_FILE_TEST_A = "from-real-env";
  const file = writeTempEnv("ENV_FILE_TEST_A=from-file\n");
  loadEnvFile(file);
  assert.equal(process.env.ENV_FILE_TEST_A, "from-real-env");
});

test("skips blank lines and comments", () => {
  const file = writeTempEnv("\n# a comment\n  \nENV_FILE_TEST_C=set\n# ENV_FILE_TEST_A=nope\n");
  loadEnvFile(file);
  assert.equal(process.env.ENV_FILE_TEST_C, "set");
  assert.equal(process.env.ENV_FILE_TEST_A, undefined);
});

test("a missing file is a no-op, not an error", () => {
  assert.doesNotThrow(() => loadEnvFile("/no/such/path/.env"));
});
