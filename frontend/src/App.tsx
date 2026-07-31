import { useEffect, useState } from "react";
import {
  api,
  DEMO_MODE,
  PIN_DURATIONS,
  type Chat,
  type Contact,
  type ListSection,
  type Message,
  type MessageButton,
  type OutgoingFile,
} from "./api.js";
import { ChatList } from "./components/ChatList.js";
import { ChatHeader } from "./components/ChatHeader.js";
import { ChatThread } from "./components/ChatThread.js";
import { Composer } from "./components/Composer.js";
import { CommandBar } from "./components/CommandBar.js";

function WelcomeScreen() {
  return (
    <div className="empty-state">
      <div className="empty-state-mark">#</div>
      <div className="empty-state-title">WhatsApp#</div>
      <p>Select a chat to start reading — or ask the AI bar about one once it's open.</p>
    </div>
  );
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Real, non-estimated signal from the backend: `truncated` is true only when the fetch hit
  // its cap (see routes/chats.ts) — WAHA's own API returns no total-count/has-more field.
  const [historyTruncated, setHistoryTruncated] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  async function loadMessages(chatId: string) {
    const { messages, limit, truncated } = await api.getMessages(chatId);
    setMessages(messages);
    setHistoryLimit(limit);
    setHistoryTruncated(truncated);
  }

  /** "Load older messages": pages backwards using the count already in state as the offset, and
   *  prepends whatever comes back. De-duped by id since a page landing exactly on a message we
   *  already have (chat activity shifted the window between fetches) is possible; a page that
   *  adds nothing new is treated as "no more history" so the button can't spin forever. */
  async function handleLoadOlder() {
    if (!selectedId || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const { messages: older, truncated } = await api.getMessages(selectedId, messages.length);
      const existingIds = new Set(messages.map((m) => m.id));
      const fresh = older.filter((m) => !existingIds.has(m.id));
      setMessages((ms) => [...fresh, ...ms]);
      setHistoryTruncated(fresh.length > 0 && truncated);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    api.listChats().then(setChats).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId).catch(console.error);
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
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendImage(file: OutgoingFile) {
    if (!selectedId) return;
    try {
      await api.sendImage(selectedId, file);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendVideo(file: OutgoingFile) {
    if (!selectedId) return;
    try {
      await api.sendVideo(selectedId, file);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendFile(file: OutgoingFile) {
    if (!selectedId) return;
    try {
      await api.sendFile(selectedId, file);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendLocation(latitude: number, longitude: number, name?: string) {
    if (!selectedId) return;
    try {
      await api.sendLocation(selectedId, latitude, longitude, name);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendVoice(file: OutgoingFile) {
    if (!selectedId) return;
    try {
      await api.sendVoice(selectedId, file);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendPoll(name: string, options: string[], multipleAnswers: boolean) {
    if (!selectedId) return;
    try {
      await api.sendPoll(selectedId, name, options, multipleAnswers);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleVotePoll(messageId: string, votes: string[]) {
    if (!selectedId) return;
    try {
      await api.votePoll(selectedId, messageId, votes);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendButtons(body: string, buttons: MessageButton[], footer?: string) {
    if (!selectedId) return;
    try {
      await api.sendButtons(selectedId, body, buttons, footer);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSendList(
    body: string,
    buttonText: string,
    sections: ListSection[],
    footer?: string,
  ) {
    if (!selectedId) return;
    try {
      await api.sendList(selectedId, body, buttonText, sections, footer);
      await loadMessages(selectedId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleShareContact(contact: Contact) {
    if (!selectedId) return;
    try {
      await api.sendContact(
        selectedId,
        contact.id,
        contact.name || contact.pushname,
        contact.number,
      );
      await loadMessages(selectedId);
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

  // WAHA has no "is this contact blocked" getter (block/unblock are one-way actions) — so
  // `isBlocked` only ever reflects a toggle made from this client this session, same honest
  // limitation as the profile "about" field (see docs/waha-coverage.md).
  async function handleToggleBlock(chatId: string) {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    const nextBlocked = !chat.isBlocked;
    const prev = chats;
    setChats((cs) => cs.map((c) => (c.id === chatId ? { ...c, isBlocked: nextBlocked } : c)));
    try {
      if (nextBlocked) await api.blockContact(chatId);
      else await api.unblockContact(chatId);
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
   *  selects it — the first `sendMessage` is what actually creates it on WAHA's side. */
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
      avatarColor: "#dcd3c4",
    };
    setChats((cs) => [newChat, ...cs]);
    setSelectedId(newChat.id);
  }

  /** Backs "New group" / "Join group": the group already exists on WAHA's side by the time
   *  this fires (creation/join already happened) — seed a chat-list entry and select it, same
   *  shape as `handleStartNewChatFromContact`. */
  function handleGroupCreatedOrJoined(groupId: string, name?: string) {
    const existing = chats.find((c) => c.id === groupId);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    const label = name || groupId;
    const newChat: Chat = {
      id: groupId,
      name: label,
      avatarInitials: label.slice(0, 2).toUpperCase() || "#",
      avatarColor: "#aebf92",
      isGroup: true,
    };
    setChats((cs) => [newChat, ...cs]);
    setSelectedId(newChat.id);
  }

  function handleGroupSubjectChange(chatId: string, subject: string) {
    setChats((cs) => cs.map((c) => (c.id === chatId ? { ...c, name: subject } : c)));
  }

  function handleGroupLeftOrDeleted(chatId: string) {
    setChats((cs) => cs.filter((c) => c.id !== chatId));
    if (chatId === selectedId) {
      setSelectedId(null);
      setMessages([]);
    }
  }

  /** Backs the contacts-picker "New chat" flow: the contact is already a known WhatsApp id, so
   *  unlike `handleStartNewChat` there's no `checkNumberExists` round trip needed. */
  function handleStartNewChatFromContact(contact: Contact) {
    const existing = chats.find((c) => c.id === contact.id);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    const name = contact.name || contact.pushname || contact.number || contact.id;
    const newChat: Chat = {
      id: contact.id,
      name,
      avatarInitials: name.slice(0, 1).toUpperCase() || "#",
      avatarColor: "#dcd3c4",
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
          <span className="demo-banner-dot" />
          Demo — mock data only, not connected to any real WhatsApp account
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
            onStartNewChatFromContact={handleStartNewChatFromContact}
            onGroupCreatedOrJoined={handleGroupCreatedOrJoined}
          />
        </aside>
        <main className="main">
          <div className="chat-decor chat-decor-1" />
          <div className="chat-decor chat-decor-2" />
          {selectedChat ? (
            <>
              <ChatHeader
                chat={selectedChat}
                onToggleArchive={() => handleToggleArchive(selectedChat.id)}
                onToggleBlock={() => handleToggleBlock(selectedChat.id)}
                onClearMessages={() => handleClearMessages(selectedChat.id)}
                onDeleteChat={() => handleDeleteChat(selectedChat.id)}
                onGroupSubjectChange={handleGroupSubjectChange}
                onGroupLeftOrDeleted={handleGroupLeftOrDeleted}
              />
              <ChatThread
                messages={messages}
                historyTruncated={historyTruncated}
                historyLimit={historyLimit}
                onLoadOlder={handleLoadOlder}
                loadingOlder={loadingOlder}
                onReact={handleReact}
                onToggleStar={handleToggleStar}
                onTogglePin={handleTogglePin}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onVotePoll={handleVotePoll}
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
                onSendVoice={handleSendVoice}
                onSendPoll={handleSendPoll}
                onSendLocation={handleSendLocation}
                onShareContact={handleShareContact}
                onSendButtons={handleSendButtons}
                onSendList={handleSendList}
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
