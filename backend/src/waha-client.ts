import { config } from "./config.js";

export interface WahaChat {
  id: string;
  name?: string;
  lastMessage?: unknown;
  [key: string]: unknown;
}

export interface WahaMessage {
  id: string;
  timestamp: number;
  from: string;
  fromMe: boolean;
  body: string;
  [key: string]: unknown;
}

class WahaError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`WAHA request failed (${status}): ${body}`);
  }
}

async function wahaFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${config.wahaBaseUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (config.wahaApiKey) headers["X-Api-Key"] = config.wahaApiKey;

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new WahaError(res.status, text);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/** Thin wrapper over the subset of the WAHA REST API this client needs.
 *  See https://waha.devlike.pro/ for the full API surface. */
export const waha = {
  listSessions: () => wahaFetch<unknown[]>("/api/sessions"),

  listChats: (session = config.wahaSession) =>
    wahaFetch<WahaChat[]>(`/api/${session}/chats`),

  chatsOverview: (session = config.wahaSession, limit = 50) =>
    wahaFetch<WahaChat[]>(`/api/${session}/chats/overview?limit=${limit}`),

  getMessages: (chatId: string, session = config.wahaSession, limit = 100) =>
    wahaFetch<WahaMessage[]>(
      `/api/${session}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`,
    ),

  sendText: (chatId: string, text: string, session = config.wahaSession) =>
    wahaFetch<WahaMessage>("/api/sendText", {
      method: "POST",
      body: JSON.stringify({ session, chatId, text }),
    }),
};
