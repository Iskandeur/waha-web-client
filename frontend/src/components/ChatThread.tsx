import { useLayoutEffect, useRef } from "react";
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
  onLoadOlder,
  loadingOlder,
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
  onLoadOlder?: () => void;
  loadingOlder?: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onToggleStar: (messageId: string, starred: boolean) => void;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  onEditMessage: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onVotePoll: (messageId: string, votes: string[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesRef = useRef<Message[]>([]);
  const prevScrollHeightRef = useRef(0);

  // Keeps the thread anchored correctly whichever end grew: a brand-new chat or a message sent
  // or received at the bottom scrolls to the end as before; "load older" prepends messages above
  // the current viewport, which browsers don't compensate for on their own (scrollTop is left
  // unchanged, so the whole thread visually jumps) — so that case adjusts scrollTop by exactly
  // how much taller the content got instead.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const prev = prevMessagesRef.current;
    if (container) {
      const prevLastId = prev[prev.length - 1]?.id;
      const newLastId = messages[messages.length - 1]?.id;
      const prevFirstId = prev[0]?.id;
      const newFirstId = messages[0]?.id;

      if (prev.length === 0 || newLastId !== prevLastId) {
        bottomRef.current?.scrollIntoView({ block: "end" });
      } else if (newFirstId !== prevFirstId) {
        const delta = container.scrollHeight - prevScrollHeightRef.current;
        container.scrollTop += delta;
      }
      prevScrollHeightRef.current = container.scrollHeight;
    }
    prevMessagesRef.current = messages;
  }, [messages]);

  return (
    <div className="chat-thread" ref={containerRef}>
      {historyTruncated && (
        <div className="history-load-older">
          <button type="button" onClick={onLoadOlder} disabled={loadingOlder}>
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}
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
