import { useState } from "react";
import type { Message } from "../api.js";
import { SmileIcon, StarIcon } from "./icons.js";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Hover toolbar on a message bubble: quick-react emoji picker + star toggle. Shown on hover
 *  via CSS (`.message:hover .message-actions`), not on every message, to keep the thread calm. */
export function MessageActions({
  message,
  onReact,
  onToggleStar,
}: {
  message: Message;
  onReact: (emoji: string) => void;
  onToggleStar: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="message-actions">
      {pickerOpen && (
        <div className="reaction-picker">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="reaction-picker-option"
              onClick={() => {
                onReact(message.reaction === emoji ? "" : emoji);
                setPickerOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="message-action-btn"
        aria-label="React"
        title="React"
        onClick={() => setPickerOpen((v) => !v)}
      >
        <SmileIcon size={16} />
      </button>
      <button
        type="button"
        className={message.starred ? "message-action-btn active" : "message-action-btn"}
        aria-label={message.starred ? "Unstar" : "Star"}
        title={message.starred ? "Unstar" : "Star"}
        onClick={onToggleStar}
      >
        <StarIcon size={16} filled={message.starred} />
      </button>
    </div>
  );
}
