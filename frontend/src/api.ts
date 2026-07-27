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

export const api = {
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
