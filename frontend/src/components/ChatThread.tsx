import { useEffect, useRef } from "react";
import type { Message } from "../api.js";
import { formatDateSeparator, isSameCalendarDay } from "../format.js";
import { MessageBubble } from "./MessageBubble.js";

function senderKey(m: Message): string {
  return m.fromMe ? "me" : (m.senderName ?? "them");
}

export function ChatThread({
  messages,
  historyTruncated,
  historyLimit,
  onReact,
  onToggleStar,
  onTogglePin,
  onEditMessage,
  onDeleteMessage,
  onVotePoll,
}: {
  messages: Message[];
  historyTruncated?: boolean;
  historyLimit?: number;
  onReact: (messageId: string, emoji: string) => void;
  onToggleStar: (messageId: string, starred: boolean) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  onEditMessage: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onVotePoll: (messageId: string, votes: string[]) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="chat-thread">
      {Boolean(historyLimit) && messages.length > 0 && (
        <div className="history-notice">
          {historyTruncated
            ? `Showing the most recent ${messages.length} messages loaded from this session — older history exists but wasn't fetched here.`
            : `${messages.length} message${messages.length === 1 ? "" : "s"} loaded from this session — may not match the full history on your phone.`}
        </div>
      )}
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
              onVotePoll={m.type === "poll" ? (votes) => onVotePoll(m.id, votes) : undefined}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
