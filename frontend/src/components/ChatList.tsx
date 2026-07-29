import { useMemo, useState } from "react";
import type { Chat } from "../api.js";
import { formatListTimestamp } from "../format.js";
import { Avatar } from "./Avatar.js";
import { StatusTicks } from "./StatusTicks.js";
import { PinIcon, SearchIcon } from "./icons.js";

type Filter = "all" | "unread" | "groups";

function ChatListItem({
  chat,
  active,
  onSelect,
}: {
  chat: Chat;
  active: boolean;
  onSelect: () => void;
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
    </li>
  );
}

export function ChatList({
  chats,
  selectedId,
  onSelect,
}: {
  chats: Chat[];
  selectedId: string | null;
  onSelect: (chatId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .filter((c) => {
        if (filter === "unread") return (c.unreadCount ?? 0) > 0;
        if (filter === "groups") return Boolean(c.isGroup);
        return true;
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [chats, query, filter]);

  return (
    <div className="sidebar-inner">
      <div className="sidebar-search">
        <SearchIcon size={16} className="sidebar-search-icon" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or start a new chat"
        />
      </div>
      <div className="sidebar-filters">
        {(["all", "unread", "groups"] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? "filter-tab active" : "filter-tab"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "unread" ? "Unread" : "Groups"}
          </button>
        ))}
      </div>
      <ul className="chat-list">
        {visible.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            active={chat.id === selectedId}
            onSelect={() => onSelect(chat.id)}
          />
        ))}
        {visible.length === 0 && <li className="chat-list-empty">No chats match.</li>}
      </ul>
    </div>
  );
}
