import { useEffect, useState } from "react";
import { api, DEMO_MODE, type Chat, type Message } from "./api.js";
import { ChatList } from "./components/ChatList.js";
import { ChatHeader } from "./components/ChatHeader.js";
import { ChatThread } from "./components/ChatThread.js";
import { Composer } from "./components/Composer.js";
import { CommandBar } from "./components/CommandBar.js";

function WelcomeScreen() {
  return (
    <div className="empty-state">
      <div className="empty-state-title">WhatsApp#</div>
      <p>Select a chat to start reading — or ask the AI bar about one once it's open.</p>
    </div>
  );
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    api.listChats().then(setChats).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.getMessages(selectedId).then(setMessages).catch(console.error);
    setChats((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)),
    );
  }, [selectedId]);

  useEffect(() => {
    if (!sendError) return;
    const t = setTimeout(() => setSendError(null), 5000);
    return () => clearTimeout(t);
  }, [sendError]);

  async function handleSend(text: string) {
    if (!selectedId) return;
    try {
      await api.sendMessage(selectedId, text);
      setDraft("");
      setMessages(await api.getMessages(selectedId));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="app">
      {DEMO_MODE && (
        <div className="demo-banner">
          🎭 Demo — mock data only, not connected to any real WhatsApp account
        </div>
      )}
      <div className="app-body">
        <aside className="sidebar">
          <ChatList chats={chats} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <main className="main">
          {selectedChat ? (
            <>
              <ChatHeader chat={selectedChat} />
              <ChatThread messages={messages} />
              {sendError && <div className="send-error-banner">Message not sent: {sendError}</div>}
              <CommandBar
                run={(instruction) => api.runAiCommand(selectedChat.id, instruction)}
                onResult={setDraft}
              />
              <Composer value={draft} onChange={setDraft} onSend={handleSend} />
            </>
          ) : (
            <WelcomeScreen />
          )}
        </main>
      </div>
    </div>
  );
}
