import type { Chat } from "../api.js";
import { Avatar } from "./Avatar.js";
import { MoreVerticalIcon, SearchIcon } from "./icons.js";

export function ChatHeader({ chat }: { chat: Chat }) {
  return (
    <header className="chat-header">
      <Avatar initials={chat.avatarInitials} color={chat.avatarColor} size={40} />
      <div className="chat-header-info">
        <div className="chat-header-name">{chat.name}</div>
        {chat.presence && <div className="chat-header-presence">{chat.presence}</div>}
      </div>
      <div className="chat-header-actions">
        <SearchIcon size={19} />
        <MoreVerticalIcon size={19} />
      </div>
    </header>
  );
}
