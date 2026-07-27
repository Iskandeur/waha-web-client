import type { WahaMessage } from "../waha-client.js";
import { runClaude } from "./claude-runner.js";

function formatThread(messages: WahaMessage[]): string {
  return messages
    .slice(-50)
    .map((m) => `${m.fromMe ? "me" : m.from}: ${m.body}`)
    .join("\n");
}

/** The AI command bar feature: turns a free-text instruction ("summarize this
 *  thread", "draft a friendly reply", "find the last message about the trip")
 *  plus the recent thread into a single `claude -p` call, and returns plain
 *  text meant to be shown as a suggestion (never auto-sent). */
export async function runThreadCommand(
  instruction: string,
  messages: WahaMessage[],
): Promise<string> {
  const thread = formatThread(messages);
  const prompt = [
    "You are an assistant embedded in a WhatsApp web client, helping the user",
    "act on one conversation thread. You only ever produce a suggestion for a",
    "human to review — you never send anything yourself.",
    "",
    "Conversation (oldest first, 'me' is the user):",
    "---",
    thread || "(no messages)",
    "---",
    "",
    `User's instruction: ${instruction}`,
    "",
    "Reply with only the requested output (a summary, a draft reply, an answer",
    "to a lookup question, etc.) — no preamble, no meta-commentary.",
  ].join("\n");

  return runClaude(prompt);
}
