import { useEffect, useState } from "react";
import { api, DEMO_MODE, PIN_DURATIONS, type Chat, type Message, type OutgoingFile } from "./api.js";
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
    // Best-effort: a failed read-receipt shouldn't block opening the chat, and the local
    // unreadCount reset above already gives instant UI feedback either way.
    api.markRead(selectedId).catch(() => undefined);
    api.subscribePresence(selectedId).catch(() => undefined);
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

  async function handleSendImage(file: OutgoingFile) {
    if (!selectedId) return;
    try {
      await api.sendImage(selectedId, file);
      setMessages(await api.getMessages(selectedId));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendVideo(file: OutgoingFile) {
    if (!selectedId) return;
    try {
      await api.sendVideo(selectedId, file);
      setMessages(await api.getMessages(selectedId));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendFile(file: OutgoingFile) {
    if (!selectedId) return;
    try {
      await api.sendFile(selectedId, file);
      setMessages(await api.getMessages(selectedId));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  // Optimistic: flip the UI immediately, revert if the WAHA call actually fails (guard block,
  // network error, ...) rather than making every reaction/star wait on a round trip.
  async function handleReact(messageId: string, emoji: string) {
    if (!selectedId) return;
    const prev = messages;
    setMessages((ms) => ms.map((m) => (m.id === messageId ? { ...m, reaction: emoji || undefined } : m)));
    try {
      await api.setReaction(selectedId, messageId, emoji);
    } catch (err) {
      setMessages(prev);
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleToggleStar(messageId: string, starred: boolean) {
    if (!selectedId) return;
    const prev = messages;
    setMessages((ms) => ms.map((m) => (m.id === messageId ? { ...m, starred } : m)));
    try {
      await api.setStar(selectedId, messageId, starred);
    } catch (err) {
      setMessages(prev);
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleTogglePin(messageId: string, pinned: boolean) {
    if (!selectedId) return;
    const prev = messages;
    setMessages((ms) => ms.map((m) => (m.id === messageId ? { ...m, pinned } : m)));
    try {
      if (pinned) await api.pinMessage(selectedId, messageId, PIN_DURATIONS["24h"]);
      else await api.unpinMessage(selectedId, messageId);
    } catch (err) {
      setMessages(prev);
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleToggleUnread(chatId: string) {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    const wasUnread = (chat.unreadCount ?? 0) > 0;
    const prev = chats;
    setChats((cs) =>
      cs.map((c) => (c.id === chatId ? { ...c, unreadCount: wasUnread ? 0 : 1 } : c)),
    );
    try {
      if (wasUnread) await api.markRead(chatId);
      else await api.markUnread(chatId);
    } catch (err) {
      setChats(prev);
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
          <ChatList
            chats={chats}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggleUnread={handleToggleUnread}
          />
        </aside>
        <main className="main">
          {selectedChat ? (
            <>
              <ChatHeader chat={selectedChat} />
              <ChatThread
                messages={messages}
                onReact={handleReact}
                onToggleStar={handleToggleStar}
                onTogglePin={handleTogglePin}
              />
              {sendError && <div className="send-error-banner">Message not sent: {sendError}</div>}
              <CommandBar
                run={(instruction) => api.runAiCommand(selectedChat.id, instruction)}
                onResult={setDraft}
              />
              <Composer
                value={draft}
                onChange={setDraft}
                onSend={handleSend}
                onSendImage={handleSendImage}
                onSendVideo={handleSendVideo}
                onSendFile={handleSendFile}
              />
            </>
          ) : (
            <WelcomeScreen />
          )}
        </main>
      </div>
    </div>
  );
}
