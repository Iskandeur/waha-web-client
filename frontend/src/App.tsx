import { useEffect, useState } from "react";
import { api, DEMO_MODE, type Chat, type Message } from "./api.js";
import { ChatList } from "./components/ChatList.js";
import { ChatThread } from "./components/ChatThread.js";
import { Composer } from "./components/Composer.js";
import { CommandBar } from "./components/CommandBar.js";

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    api.listChats().then(setChats).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.getMessages(selectedId).then(setMessages).catch(console.error);
  }, [selectedId]);

  async function handleSend(text: string) {
    if (!selectedId) return;
    await api.sendMessage(selectedId, text);
    setMessages(await api.getMessages(selectedId));
  }

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
          {selectedId ? (
            <>
              <ChatThread messages={messages} />
              <CommandBar
                run={(instruction) => api.runAiCommand(selectedId, instruction)}
                onResult={setDraft}
              />
              <Composer value={draft} onSend={handleSend} />
            </>
          ) : (
            <div className="empty-state">Select a chat to get started.</div>
          )}
        </main>
      </div>
    </div>
  );
}
