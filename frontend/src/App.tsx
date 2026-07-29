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

  async function handleToggleArchive(chatId: string) {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    const nextArchived = !chat.isArchived;
    const prev = chats;
    setChats((cs) => cs.map((c) => (c.id === chatId ? { ...c, isArchived: nextArchived } : c)));
    try {
      if (nextArchived) await api.archiveChat(chatId);
      else await api.unarchiveChat(chatId);
    } catch (err) {
      setChats(prev);
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleClearMessages(chatId: string) {
    if (!window.confirm("Clear all messages in this chat? This can't be undone.")) return;
    try {
      await api.clearChatMessages(chatId);
      if (chatId === selectedId) setMessages([]);
      setChats((cs) =>
        cs.map((c) =>
          c.id === chatId
            ? {
                ...c,
                lastMessagePreview: undefined,
                lastMessageAt: undefined,
                lastMessageFromMe: undefined,
                lastMessageStatus: undefined,
              }
            : c,
        ),
      );
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteChat(chatId: string) {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
    const prev = chats;
    setChats((cs) => cs.filter((c) => c.id !== chatId));
    if (chatId === selectedId) {
      setSelectedId(null);
      setMessages([]);
    }
    try {
      await api.deleteChat(chatId);
    } catch (err) {
      setChats(prev);
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleEditMessage(messageId: string, text: string) {
    if (!selectedId) return;
    const prev = messages;
    setMessages((ms) => ms.map((m) => (m.id === messageId ? { ...m, body: text } : m)));
    try {
      await api.editMessage(selectedId, messageId, text);
    } catch (err) {
      setMessages(prev);
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!selectedId) return;
    if (!window.confirm("Delete this message?")) return;
    const prev = messages;
    setMessages((ms) => ms.filter((m) => m.id !== messageId));
    try {
      await api.deleteMessage(selectedId, messageId);
    } catch (err) {
      setMessages(prev);
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  /** Backs the chat list's "Start chat with <number>" affordance: confirms the number is on
   *  WhatsApp, then either jumps to the existing chat or seeds a fresh (message-less) one and
   *  selects it — the first `sendMessage` is what actually creates the chat on WAHA's side. */
  async function handleStartNewChat(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) throw new Error("Enter a valid phone number");
    const result = await api.checkNumberExists(digits);
    if (!result.numberExists || !result.chatId) {
      throw new Error("This number isn't on WhatsApp");
    }
    const existing = chats.find((c) => c.id === result.chatId);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    const newChat: Chat = {
      id: result.chatId,
      name: phone.trim(),
      avatarInitials: digits.slice(-2) || "#",
      avatarColor: "#64748b",
    };
    setChats((cs) => [newChat, ...cs]);
    setSelectedId(newChat.id);
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
            onStartNewChat={handleStartNewChat}
          />
        </aside>
        <main className="main">
          {selectedChat ? (
            <>
              <ChatHeader
                chat={selectedChat}
                onToggleArchive={() => handleToggleArchive(selectedChat.id)}
                onClearMessages={() => handleClearMessages(selectedChat.id)}
                onDeleteChat={() => handleDeleteChat(selectedChat.id)}
              />
              <ChatThread
                messages={messages}
                onReact={handleReact}
                onToggleStar={handleToggleStar}
                onTogglePin={handleTogglePin}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
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
