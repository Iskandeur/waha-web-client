import { useEffect, useState } from "react";
import { api, type Chat } from "../api.js";
import { formatPresence } from "../format.js";
import { Avatar } from "./Avatar.js";
import { ArchiveIcon, MoreVerticalIcon, SearchIcon, TrashIcon } from "./icons.js";

export function ChatHeader({
  chat,
  onToggleArchive,
  onClearMessages,
  onDeleteChat,
}: {
  chat: Chat;
  onToggleArchive: () => void;
  onClearMessages: () => void;
  onDeleteChat: () => void;
}) {
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Falls back to the chat list's static presence text until the live fetch resolves — a group
  // chat has no single peer presence, so it keeps the "who's in it" text either way.
  const [presence, setPresence] = useState<string | undefined>(chat.presence);

  useEffect(() => {
    setMenuOpen(false);
  }, [chat.id]);

  useEffect(() => {
    setPictureUrl(null);
    api
      .getChatPicture(chat.id)
      .then((res) => setPictureUrl(res.url))
      .catch(() => setPictureUrl(null));
  }, [chat.id]);

  useEffect(() => {
    setPresence(chat.presence);
    if (chat.isGroup) return;
    api
      .getPresence(chat.id)
      .then((res) => {
        const peer = res.presences[0];
        if (peer) setPresence(formatPresence(peer.lastKnownPresence, peer.lastSeen));
      })
      .catch(() => undefined);
  }, [chat.id, chat.isGroup, chat.presence]);

  return (
    <header className="chat-header">
      <Avatar initials={chat.avatarInitials} color={chat.avatarColor} size={40} src={pictureUrl} />
      <div className="chat-header-info">
        <div className="chat-header-name">{chat.name}</div>
        {presence && <div className="chat-header-presence">{presence}</div>}
      </div>
      <div className="chat-header-actions">
        <SearchIcon size={19} />
        <div className="chat-header-menu-wrap">
          <button
            type="button"
            className="chat-header-menu-btn"
            aria-label="Chat menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVerticalIcon size={19} />
          </button>
          {menuOpen && (
            <div className="chat-header-menu">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleArchive();
                }}
              >
                <ArchiveIcon size={16} />
                {chat.isArchived ? "Unarchive chat" : "Archive chat"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onClearMessages();
                }}
              >
                <TrashIcon size={16} />
                Clear messages
              </button>
              <button
                type="button"
                className="chat-header-menu-danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDeleteChat();
                }}
              >
                <TrashIcon size={16} />
                Delete chat
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
