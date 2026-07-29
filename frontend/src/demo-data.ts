import type { Chat, Message, MessageStatus, MessageType } from "./api.js";
import { messagePreview } from "./format.js";

const NOW = Math.floor(Date.now() / 1000);
const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function ago(seconds: number): number {
  return NOW - seconds;
}

interface RawMessage {
  timestamp: number;
  fromMe: boolean;
  type: MessageType;
  body: string;
  senderName?: string;
  status?: MessageStatus;
  mediaName?: string;
  durationSec?: number;
}

const RAW_MESSAGES: Record<string, RawMessage[]> = {
  "demo-1": [
    { timestamp: ago(2 * DAY), fromMe: false, type: "text", body: "Hey! Are we still on for Friday?" },
    { timestamp: ago(2 * DAY - 60), fromMe: true, type: "text", body: "Yep, 7pm works for me.", status: "read" },
    { timestamp: ago(2 * DAY - 90), fromMe: false, type: "text", body: "Perfect, see you then 🙂" },
    { timestamp: ago(5 * MIN), fromMe: false, type: "text", body: "Also — could you send the address again?" },
    { timestamp: ago(2 * MIN), fromMe: false, type: "text", body: "No rush, whenever you get a sec" },
  ],
  "demo-2": [
    { timestamp: ago(HOUR), fromMe: false, type: "text", body: "Found a place for the trip, sending the link" },
    { timestamp: ago(HOUR - 30), fromMe: false, type: "image", body: "Rooftop with a view, 4 beds" },
    { timestamp: ago(20 * MIN), fromMe: false, type: "text", body: "https://example.com/listing/123" },
    { timestamp: ago(3 * MIN), fromMe: false, type: "text", body: "Let me know what you think!" },
  ],
  "demo-3": [
    { timestamp: ago(DAY), fromMe: false, senderName: "Priya", type: "text", body: "Who's in for lunch tomorrow?" },
    { timestamp: ago(DAY - 60), fromMe: false, senderName: "Marco", type: "text", body: "I'm in!" },
    { timestamp: ago(DAY - 90), fromMe: true, type: "text", body: "Count me in too", status: "read" },
    { timestamp: ago(40 * MIN), fromMe: false, senderName: "Priya", type: "file", body: "", mediaName: "menu-ramen-place.pdf" },
    { timestamp: ago(35 * MIN), fromMe: false, senderName: "Marco", type: "text", body: "That place looks great, 12:30?" },
  ],
  "demo-4": [
    { timestamp: ago(3 * DAY), fromMe: true, type: "text", body: "Here's the photo from the hike", status: "read" },
    { timestamp: ago(3 * DAY - 20), fromMe: true, type: "image", body: "Summit view, worth the climb", status: "read" },
    { timestamp: ago(6 * HOUR), fromMe: false, type: "text", body: "That view is incredible, where was this?" },
    { timestamp: ago(15 * MIN), fromMe: true, type: "text", body: "Sending you the trail map now", status: "delivered" },
  ],
  "demo-5": [
    { timestamp: ago(5 * DAY), fromMe: false, senderName: "Noor", type: "text", body: "Starting the next book Monday — 'Piranesi'" },
    { timestamp: ago(12 * HOUR), fromMe: false, senderName: "Tariq", type: "voice", body: "", durationSec: 34 },
    { timestamp: ago(2 * HOUR), fromMe: true, type: "text", body: "Just finished chapter 3, no spoilers please 😅", status: "sent" },
  ],
};

export const DEMO_MESSAGES: Record<string, Message[]> = {};
for (const [chatId, msgs] of Object.entries(RAW_MESSAGES)) {
  DEMO_MESSAGES[chatId] = msgs.map((m, i) => ({ id: `${chatId}-m${i}`, ...m }));
}

function lastMessageFields(chatId: string) {
  const msgs = DEMO_MESSAGES[chatId];
  const last = msgs[msgs.length - 1];
  return {
    lastMessagePreview: messagePreview(last),
    lastMessageAt: last.timestamp,
    lastMessageFromMe: last.fromMe,
    lastMessageStatus: last.status,
  };
}

/** Canned chats for the public demo deployment — no real WhatsApp connection involved. */
export const DEMO_CHATS: Chat[] = [
  {
    id: "demo-2",
    name: "Sam — trip planning",
    avatarInitials: "S",
    avatarColor: "#8b5cf6",
    pinned: true,
    unreadCount: 3,
    presence: "online",
    ...lastMessageFields("demo-2"),
  },
  {
    id: "demo-1",
    name: "Alex",
    avatarInitials: "A",
    avatarColor: "#0ea5a4",
    unreadCount: 2,
    presence: "online",
    ...lastMessageFields("demo-1"),
  },
  {
    id: "demo-3",
    name: "Team lunch 🍜",
    avatarInitials: "TL",
    avatarColor: "#f59e0b",
    isGroup: true,
    participantsCount: 5,
    presence: "Priya, Marco, +3 others",
    ...lastMessageFields("demo-3"),
  },
  {
    id: "demo-4",
    name: "Jordan",
    avatarInitials: "J",
    avatarColor: "#3b82f6",
    presence: "last seen today at 09:14",
    ...lastMessageFields("demo-4"),
  },
  {
    id: "demo-5",
    name: "Book club 📚",
    avatarInitials: "BC",
    avatarColor: "#ef4444",
    isGroup: true,
    participantsCount: 8,
    presence: "Noor, Tariq, +6 others",
    ...lastMessageFields("demo-5"),
  },
];

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
  listChats: () =>
    delay([...DEMO_CHATS].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))),

  getMessages: (chatId: string) => delay(DEMO_MESSAGES[chatId] ?? []),

  sendMessage: (chatId: string, text: string) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "text",
      body: text,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = messagePreview(message);
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  runAiCommand: (_chatId: string, instruction: string) =>
    delay({ suggestion: demoAiCommand(instruction) }, 500),
};
