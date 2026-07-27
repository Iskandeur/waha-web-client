import { spawn } from "node:child_process";
import { config } from "../config.js";

/** Runs `claude -p <prompt>` non-interactively and returns stdout.
 *
 *  Uses the official Claude Code CLI (OAuth-authenticated session on the host),
 *  never a raw Anthropic API key — this keeps the AI command bar on the same
 *  billing/auth surface as the rest of the machine it runs on. */
export function runClaude(prompt: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.claudeBin, ["-p", prompt], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("claude -p timed out"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude -p exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}
