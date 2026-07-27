import type { Chat } from "../api.js";

export function ChatList({
  chats,
  selectedId,
  onSelect,
}: {
  chats: Chat[];
  selectedId: string | null;
  onSelect: (chatId: string) => void;
}) {
  return (
    <ul className="chat-list">
      {chats.map((chat) => (
        <li
          key={chat.id}
          className={chat.id === selectedId ? "chat-list-item active" : "chat-list-item"}
          onClick={() => onSelect(chat.id)}
        >
          {chat.name ?? chat.id}
        </li>
      ))}
    </ul>
  );
}
