import { demoApi } from "./demo-data.js";

export type MessageStatus = "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "file" | "voice";

export interface Chat {
  id: string;
  name: string;
  avatarInitials: string;
  avatarColor: string;
  isGroup?: boolean;
  participantsCount?: number;
  presence?: string;
  pinned?: boolean;
  unreadCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: number;
  lastMessageFromMe?: boolean;
  lastMessageStatus?: MessageStatus;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  timestamp: number;
  fromMe: boolean;
  senderName?: string;
  type: MessageType;
  body: string;
  mediaName?: string;
  durationSec?: number;
  status?: MessageStatus;
  [key: string]: unknown;
}

export interface SendError {
  error: string;
  reason?: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    let parsed: SendError | undefined;
    try {
      parsed = JSON.parse(body);
    } catch {
      // not JSON — fall through to a generic error below
    }
    const err = new Error(parsed?.reason ?? parsed?.error ?? `${res.status} ${body}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

/** Demo mode is the default: it never calls a backend or a real WAHA/WhatsApp session.
 *  Set VITE_DEMO_MODE=false (self-hosted, real WAHA instance) to use the real API. */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

const realApi = {
  listChats: () => fetch("/api/chats").then((r) => json<Chat[]>(r)),

  getMessages: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`).then((r) =>
      json<Message[]>(r),
    ),

  sendMessage: (chatId: string, text: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => json<Message>(r)),

  runAiCommand: (chatId: string, instruction: string) =>
    fetch("/api/ai/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, instruction }),
    }).then((r) => json<{ suggestion: string }>(r)),
};

export const api = DEMO_MODE ? demoApi : realApi;
