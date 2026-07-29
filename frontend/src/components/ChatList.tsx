import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, type Chat, type Contact } from "../api.js";
import { formatListTimestamp } from "../format.js";
import { Avatar } from "./Avatar.js";
import { ContactPicker } from "./ContactPicker.js";
import { JoinGroupModal } from "./JoinGroupModal.js";
import { LabelFilter } from "./LabelFilter.js";
import { NewGroupFlow } from "./NewGroupFlow.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { StatusTicks } from "./StatusTicks.js";
import { MailIcon, PinIcon, PlusIcon, SearchIcon, SettingsIcon, UsersIcon } from "./icons.js";

type Filter = "all" | "unread" | "groups" | "archived";

/** A query is "phone-shaped" once it has enough digits to plausibly be a number rather than a
 *  name search — lets the empty-results state offer "start a chat with +1 555…" without
 *  hijacking every ordinary name search that happens to contain a digit or two. */
function looksLikePhoneNumber(query: string): boolean {
  return query.replace(/\D/g, "").length >= 6;
}

function ChatListItem({
  chat,
  active,
  onSelect,
  onToggleUnread,
}: {
  chat: Chat;
  active: boolean;
  onSelect: () => void;
  onToggleUnread: () => void;
}) {
  const hasUnread = (chat.unreadCount ?? 0) > 0;
  return (
    <li
      className={active ? "chat-list-item active" : "chat-list-item"}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <Avatar initials={chat.avatarInitials} color={chat.avatarColor} />
      <div className="chat-list-item-body">
        <div className="chat-list-item-row">
          <span className="chat-list-item-name">{chat.name}</span>
          {chat.lastMessageAt !== undefined && (
            <span className={hasUnread ? "chat-list-item-time unread" : "chat-list-item-time"}>
              {formatListTimestamp(chat.lastMessageAt)}
            </span>
          )}
        </div>
        <div className="chat-list-item-row">
          <span className="chat-list-item-preview">
            {chat.lastMessageFromMe && <StatusTicks status={chat.lastMessageStatus} />}
            {chat.lastMessagePreview ?? "No messages yet"}
          </span>
          {chat.pinned && !hasUnread && <PinIcon size={14} className="pin-icon" />}
          {hasUnread && <span className="unread-badge">{chat.unreadCount}</span>}
        </div>
      </div>
      <button
        type="button"
        className="chat-list-item-unread-btn"
        aria-label={hasUnread ? "Mark as read" : "Mark as unread"}
        title={hasUnread ? "Mark as read" : "Mark as unread"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleUnread();
        }}
      >
        <MailIcon size={15} filled={hasUnread} />
      </button>
    </li>
  );
}

const FILTER_LABELS: Record<Filter, string> = {
  all: "All",
  unread: "Unread",
  groups: "Groups",
  archived: "Archived",
};

type NewMenuAction = "new-chat" | "new-group" | "join-group" | null;

export function ChatList({
  chats,
  selectedId,
  onSelect,
  onToggleUnread,
  onStartNewChat,
  onStartNewChatFromContact,
  onGroupCreatedOrJoined,
}: {
  chats: Chat[];
  selectedId: string | null;
  onSelect: (chatId: string) => void;
  onToggleUnread: (chatId: string) => void;
  onStartNewChat: (phone: string) => Promise<void>;
  onStartNewChatFromContact: (contact: Contact) => void;
  onGroupCreatedOrJoined: (groupId: string, name?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [startingChat, setStartingChat] = useState(false);
  const [startChatError, setStartChatError] = useState<string | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<NewMenuAction>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [labelFilterId, setLabelFilterId] = useState<string | null>(null);
  const [labelFilterChatIds, setLabelFilterChatIds] = useState<string[] | null>(null);

  const archivedCount = useMemo(() => chats.filter((c) => c.isArchived).length, [chats]);

  useEffect(() => {
    if (!labelFilterId) {
      setLabelFilterChatIds(null);
      return;
    }
    api
      .getChatsByLabel(labelFilterId)
      .then((ids) => setLabelFilterChatIds(ids.map((c) => c.id)))
      .catch(() => setLabelFilterChatIds([]));
  }, [labelFilterId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats
      .filter((c) => (filter === "archived" ? c.isArchived : !c.isArchived))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .filter((c) => (labelFilterId ? (labelFilterChatIds ?? []).includes(c.id) : true))
      .filter((c) => {
        if (filter === "unread") return (c.unreadCount ?? 0) > 0;
        if (filter === "groups") return Boolean(c.isGroup);
        return true;
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [chats, query, filter, labelFilterId, labelFilterChatIds]);

  async function submitNewChat(e: FormEvent) {
    e.preventDefault();
    if (startingChat) return;
    setStartingChat(true);
    setStartChatError(null);
    try {
      await onStartNewChat(query);
      setQuery("");
    } catch (err) {
      setStartChatError(err instanceof Error ? err.message : String(err));
    } finally {
      setStartingChat(false);
    }
  }

  return (
    <div className="sidebar-inner">
      <div className="sidebar-search">
        <SearchIcon size={16} className="sidebar-search-icon" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setStartChatError(null);
          }}
          placeholder="Search or start a new chat"
        />
        <div className="sidebar-new-chat-wrap">
          <button
            type="button"
            className="sidebar-new-chat-btn"
            aria-label="New chat or group"
            title="New chat or group"
            onClick={() => setNewMenuOpen((v) => !v)}
          >
            <PlusIcon size={17} />
          </button>
          {newMenuOpen && (
            <div className="chat-header-menu sidebar-new-menu">
              <button
                type="button"
                onClick={() => {
                  setNewMenuOpen(false);
                  setActiveAction("new-chat");
                }}
              >
                <PlusIcon size={16} />
                New chat
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewMenuOpen(false);
                  setActiveAction("new-group");
                }}
              >
                <UsersIcon size={16} />
                New group
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewMenuOpen(false);
                  setActiveAction("join-group");
                }}
              >
                <UsersIcon size={16} />
                Join group
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="sidebar-new-chat-btn"
          aria-label="Settings"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon size={17} />
        </button>
      </div>
      {activeAction === "new-chat" && (
        <ContactPicker
          title="New chat"
          onSelect={(contact) => {
            onStartNewChatFromContact(contact);
            setActiveAction(null);
          }}
          onClose={() => setActiveAction(null)}
        />
      )}
      {activeAction === "new-group" && (
        <NewGroupFlow
          onCreated={(groupId, name) => {
            onGroupCreatedOrJoined(groupId, name);
            setActiveAction(null);
          }}
          onClose={() => setActiveAction(null)}
        />
      )}
      {activeAction === "join-group" && (
        <JoinGroupModal
          onJoined={(groupId) => {
            onGroupCreatedOrJoined(groupId);
            setActiveAction(null);
          }}
          onClose={() => setActiveAction(null)}
        />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <div className="sidebar-filters">
        {(["all", "unread", "groups", "archived"] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? "filter-tab active" : "filter-tab"}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
            {f === "archived" && archivedCount > 0 ? ` (${archivedCount})` : ""}
          </button>
        ))}
        <LabelFilter activeLabelId={labelFilterId} onSelect={setLabelFilterId} />
      </div>
      <ul className="chat-list">
        {visible.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            active={chat.id === selectedId}
            onSelect={() => onSelect(chat.id)}
            onToggleUnread={() => onToggleUnread(chat.id)}
          />
        ))}
        {visible.length === 0 && (
          <li className="chat-list-empty">
            No chats match.
            {looksLikePhoneNumber(query) && (
              <form className="new-chat-form" onSubmit={submitNewChat}>
                <button type="submit" className="new-chat-btn" disabled={startingChat}>
                  {startingChat ? "Checking…" : `Start chat with ${query}`}
                </button>
                {startChatError && <div className="new-chat-error">{startChatError}</div>}
              </form>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}
