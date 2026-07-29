import { demoApi } from "./demo-data.js";

export type MessageStatus = "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "file" | "voice" | "video";

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
  mediaUrl?: string;
  durationSec?: number;
  status?: MessageStatus;
  reaction?: string;
  starred?: boolean;
  pinned?: boolean;
  [key: string]: unknown;
}

export interface PeerPresence {
  participant: string;
  lastKnownPresence: string;
  lastSeen: number | null;
}

export interface ChatPresence {
  id: string;
  presences: PeerPresence[];
}

/** WhatsApp only supports these three pin lifetimes — mirrors the backend's `PIN_DURATIONS`. */
export const PIN_DURATIONS = {
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
} as const;

/** Either a remote URL or inline base64 data, both tagged with a mimetype — mirrors WAHA's
 *  `MessageImageRequest.file` shape (see backend `WahaFileInput`). */
export type OutgoingFile =
  | { mimetype: string; filename?: string; url: string }
  | { mimetype: string; filename?: string; data: string };

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

  sendImage: (chatId: string, file: OutgoingFile, caption?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, caption }),
    }).then((r) => json<Message>(r)),

  setReaction: (chatId: string, messageId: string, reaction: string) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reaction`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      },
    ).then((r) => json<void>(r)),

  setStar: (chatId: string, messageId: string, star: boolean) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/star`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ star }),
      },
    ).then((r) => json<void>(r)),

  getChatPicture: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/picture`).then((r) =>
      json<{ url: string | null }>(r),
    ),

  sendFile: (chatId: string, file: OutgoingFile, caption?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, caption }),
    }).then((r) => json<Message>(r)),

  sendVideo: (chatId: string, file: OutgoingFile, caption?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, caption }),
    }).then((r) => json<Message>(r)),

  markRead: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/read`, { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  markUnread: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/unread`, { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  getPresence: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/presence`).then((r) =>
      json<ChatPresence>(r),
    ),

  subscribePresence: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/presence/subscribe`, {
      method: "POST",
    }).then((r) => json<{ ok: true }>(r)),

  pinMessage: (chatId: string, messageId: string, duration: number) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/pin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration }),
      },
    ).then((r) => json<{ ok: true }>(r)),

  unpinMessage: (chatId: string, messageId: string) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/unpin`,
      { method: "POST" },
    ).then((r) => json<{ ok: true }>(r)),

  runAiCommand: (chatId: string, instruction: string) =>
    fetch("/api/ai/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, instruction }),
    }).then((r) => json<{ suggestion: string }>(r)),
};

export const api = DEMO_MODE ? demoApi : realApi;
