import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeWaha, decideWahaSetup } from "./detect-waha.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const envPath = path.join(repoRoot, ".env");
const envExamplePath = path.join(repoRoot, ".env.example");

// The value .env.example ships for WAHA_BASE_URL — also the default candidate to probe. Treating
// this exact value as "not deliberately configured" is what lets detection run for the common
// case of someone who just ran `cp .env.example .env` and hasn't touched it yet.
const EXAMPLE_DEFAULT_BASE_URL = "http://localhost:3000";

function readEnvVar(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  const line = readFileSync(filePath, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith(`${key}=`));
  if (!line) return undefined;
  const value = line.slice(line.indexOf("=") + 1).trim();
  return value === "" ? undefined : value;
}

function writeEnvVar(filePath: string, key: string, value: string): void {
  const lines = readFileSync(filePath, "utf8").split("\n");
  let replaced = false;
  const next = lines.map((l) => {
    if (l.trim().startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return l;
  });
  if (!replaced) next.push(`${key}=${value}`);
  writeFileSync(filePath, next.join("\n"));
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.log(`${question} (non-interactive shell — leaving .env untouched; answer treated as no)`);
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return answer === "" || answer === "y" || answer === "yes";
}

async function main(): Promise<void> {
  if (!existsSync(envPath)) {
    copyFileSync(envExamplePath, envPath);
    console.log("Created .env from .env.example.");
  }

  const rawExisting = readEnvVar(envPath, "WAHA_BASE_URL");
  const deliberatelyConfigured = rawExisting && rawExisting !== EXAMPLE_DEFAULT_BASE_URL ? rawExisting : undefined;

  console.log(`Checking ${EXAMPLE_DEFAULT_BASE_URL} for an already-running WAHA instance...`);
  const probe = await probeWaha(EXAMPLE_DEFAULT_BASE_URL);
  const choice = decideWahaSetup(deliberatelyConfigured, EXAMPLE_DEFAULT_BASE_URL, probe);

  if (choice.kind === "use-configured") {
    console.log(`WAHA_BASE_URL is already set to ${choice.baseUrl} in .env — leaving it as-is.`);
    return;
  }

  if (choice.kind === "use-detected") {
    console.log(`Found a WAHA instance already running at ${choice.baseUrl} (${choice.probe.reason}).`);
    const useIt = await confirm("Point whatsapp-sharp at it instead of starting a new one? [Y/n] ");
    if (useIt) {
      writeEnvVar(envPath, "WAHA_BASE_URL", choice.baseUrl);
      console.log(
        `Set WAHA_BASE_URL=${choice.baseUrl} in .env. Now fill in WAHA_API_KEY and WAHA_SESSION for ` +
          "that instance (see .env.example comments) before running npm run dev:backend.",
      );
    } else {
      console.log(
        "Left .env untouched. To start whatsapp-sharp's own bundled instance instead, run: " +
          "docker compose up -d (its default WAHA_BASE_URL already matches .env.example).",
      );
    }
    return;
  }

  console.log(
    [
      "No existing WAHA instance detected.",
      "Start the bundled disposable instance for local dev/testing: docker compose up -d",
      `.env's WAHA_BASE_URL already points at it by default (${EXAMPLE_DEFAULT_BASE_URL}) — no further change needed.`,
    ].join("\n"),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
