import { demoApi } from "./demo-data.js";

export interface Chat {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  timestamp: number;
  from: string;
  fromMe: boolean;
  body: string;
  [key: string]: unknown;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
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
