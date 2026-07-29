import type { Chat, Message } from "./api.js";

/** Canned data for the public demo deployment — no real WhatsApp connection involved. */
export const DEMO_CHATS: Chat[] = [
  { id: "demo-1", name: "Alex (demo)" },
  { id: "demo-2", name: "Sam — trip planning (demo)" },
  { id: "demo-3", name: "Team lunch 🍜 (demo)" },
];

export const DEMO_MESSAGES: Record<string, Message[]> = {
  "demo-1": [
    { id: "m1", timestamp: 1, from: "demo-1", fromMe: false, body: "Hey! Are we still on for Friday?" },
    { id: "m2", timestamp: 2, from: "me", fromMe: true, body: "Yep, 7pm works for me." },
    { id: "m3", timestamp: 3, from: "demo-1", fromMe: false, body: "Perfect, see you then 🙂" },
  ],
  "demo-2": [
    { id: "m4", timestamp: 1, from: "demo-2", fromMe: false, body: "Found a place for the trip, sending the link" },
    { id: "m5", timestamp: 2, from: "demo-2", fromMe: false, body: "https://example.com/listing/123" },
    { id: "m6", timestamp: 3, from: "me", fromMe: true, body: "Looks great, let's book it" },
  ],
  "demo-3": [
    { id: "m7", timestamp: 1, from: "demo-3", fromMe: false, body: "Who's in for lunch tomorrow?" },
    { id: "m8", timestamp: 2, from: "demo-3", fromMe: false, body: "I'm in!" },
    { id: "m9", timestamp: 3, from: "me", fromMe: true, body: "Count me in too" },
  ],
};

const CANNED_SUGGESTIONS: { match: RegExp; suggestion: string }[] = [
  {
    match: /summar/i,
    suggestion:
      "(Demo suggestion) Quick summary: plans are confirmed, no open questions — just a friendly back-and-forth.",
  },
  {
    match: /draft|repl(y|ies)/i,
    suggestion: "(Demo suggestion) Sounds good, thanks for sorting that out! Talk soon.",
  },
];

/** Simulates the backend's claude -p call with a canned reply — this deployment has no
 *  backend/claude CLI behind it, so real AI command execution only runs when self-hosted. */
export function demoAiCommand(instruction: string): string {
  const hit = CANNED_SUGGESTIONS.find((c) => c.match.test(instruction));
  return hit?.suggestion ?? `(Demo suggestion) Here's a draft reply for: "${instruction}"`;
}

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const demoApi = {
  listChats: () => delay(DEMO_CHATS),

  getMessages: (chatId: string) => delay(DEMO_MESSAGES[chatId] ?? []),

  sendMessage: (chatId: string, text: string) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from: "me",
      fromMe: true,
      body: text,
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    return delay(message);
  },

  runAiCommand: (_chatId: string, instruction: string) =>
    delay({ suggestion: demoAiCommand(instruction) }, 500),
};
