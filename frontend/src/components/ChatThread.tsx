import { useEffect, useRef } from "react";
import type { Message } from "../api.js";
import { formatDateSeparator, isSameCalendarDay } from "../format.js";
import { MessageBubble } from "./MessageBubble.js";

function senderKey(m: Message): string {
  return m.fromMe ? "me" : (m.senderName ?? "them");
}

export function ChatThread({
  messages,
  onReact,
  onToggleStar,
  onTogglePin,
  onEditMessage,
  onDeleteMessage,
}: {
  messages: Message[];
  onReact: (messageId: string, emoji: string) => void;
  onToggleStar: (messageId: string, starred: boolean) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  onEditMessage: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="chat-thread">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || !isSameCalendarDay(prev.timestamp, m.timestamp);
        const showSender = !m.fromMe && (newDay || !prev || senderKey(prev) !== senderKey(m));
        return (
          <div key={m.id}>
            {newDay && (
              <div className="date-separator">
                <span>{formatDateSeparator(m.timestamp)}</span>
              </div>
            )}
            <MessageBubble
              message={m}
              showSender={showSender}
              onReact={(emoji) => onReact(m.id, emoji)}
              onToggleStar={() => onToggleStar(m.id, !m.starred)}
              onTogglePin={() => onTogglePin(m.id, !m.pinned)}
              onEdit={(text) => onEditMessage(m.id, text)}
              onDelete={() => onDeleteMessage(m.id)}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
