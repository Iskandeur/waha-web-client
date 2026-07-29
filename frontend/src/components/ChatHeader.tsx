import { useEffect, useState } from "react";
import { api, type Chat } from "../api.js";
import { formatPresence } from "../format.js";
import { Avatar } from "./Avatar.js";
import { ContactDetailPanel } from "./ContactDetailPanel.js";
import { GroupPanel } from "./GroupPanel.js";
import {
  ArchiveIcon,
  MoreVerticalIcon,
  SearchIcon,
  ShieldIcon,
  TagIcon,
  TrashIcon,
  UsersIcon,
} from "./icons.js";
import { LabelsMenu } from "./LabelsMenu.js";

export function ChatHeader({
  chat,
  onToggleArchive,
  onToggleBlock,
  onClearMessages,
  onDeleteChat,
  onGroupSubjectChange,
  onGroupLeftOrDeleted,
}: {
  chat: Chat;
  onToggleArchive: () => void;
  onToggleBlock: () => void;
  onClearMessages: () => void;
  onDeleteChat: () => void;
  onGroupSubjectChange: (chatId: string, subject: string) => void;
  onGroupLeftOrDeleted: (chatId: string) => void;
}) {
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  // Falls back to the chat list's static presence text until the live fetch resolves — a group
  // chat has no single peer presence, so it keeps the "who's in it" text either way.
  const [presence, setPresence] = useState<string | undefined>(chat.presence);

  useEffect(() => {
    setMenuOpen(false);
    setLabelsOpen(false);
    setGroupPanelOpen(false);
    setContactPanelOpen(false);
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
      <button
        type="button"
        className="chat-header-identity"
        onClick={() => (chat.isGroup ? setGroupPanelOpen(true) : setContactPanelOpen(true))}
      >
        <Avatar initials={chat.avatarInitials} color={chat.avatarColor} size={40} src={pictureUrl} />
        <div className="chat-header-info">
          <div className="chat-header-name">{chat.name}</div>
          {presence && <div className="chat-header-presence">{presence}</div>}
        </div>
      </button>
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
              {chat.isGroup ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setGroupPanelOpen(true);
                  }}
                >
                  <UsersIcon size={16} />
                  Group info
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setContactPanelOpen(true);
                  }}
                >
                  <UsersIcon size={16} />
                  Contact info
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setLabelsOpen(true);
                }}
              >
                <TagIcon size={16} />
                Labels
              </button>
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
              {!chat.isGroup && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleBlock();
                  }}
                >
                  <ShieldIcon size={16} />
                  {chat.isBlocked ? "Unblock contact" : "Block contact"}
                </button>
              )}
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
          {labelsOpen && <LabelsMenu chatId={chat.id} onClose={() => setLabelsOpen(false)} />}
        </div>
      </div>
      {groupPanelOpen && (
        <GroupPanel
          groupId={chat.id}
          groupName={chat.name}
          onClose={() => setGroupPanelOpen(false)}
          onSubjectChange={(subject) => onGroupSubjectChange(chat.id, subject)}
          onLeftOrDeleted={() => {
            setGroupPanelOpen(false);
            onGroupLeftOrDeleted(chat.id);
          }}
        />
      )}
      {contactPanelOpen && (
        <ContactDetailPanel
          chat={chat}
          onClose={() => setContactPanelOpen(false)}
          onToggleBlock={onToggleBlock}
        />
      )}
    </header>
  );
}
