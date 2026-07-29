import { useState, type FormEvent } from "react";
import type { Message } from "../api.js";
import { formatClockTime } from "../format.js";
import { StatusTicks } from "./StatusTicks.js";
import { MessageActions } from "./MessageActions.js";
import { FileIcon, ImageIcon, PinIcon, PlayIcon, StarIcon } from "./icons.js";

function MessageContent({ m }: { m: Message }) {
  switch (m.type) {
    case "image":
      return m.mediaUrl ? (
        <div className="message-media message-media-image message-media-image-real">
          <img src={m.mediaUrl} alt={m.body || "Image"} className="message-image" />
          {m.body && <div className="message-caption">{m.body}</div>}
        </div>
      ) : (
        <div className="message-media message-media-image">
          <ImageIcon size={28} />
          {m.body && <div className="message-caption">{m.body}</div>}
        </div>
      );
    case "video":
      return m.mediaUrl ? (
        <div className="message-media message-media-video">
          <video src={m.mediaUrl} controls className="message-video" />
          {m.body && <div className="message-caption">{m.body}</div>}
        </div>
      ) : (
        <div className="message-media message-media-image">
          <PlayIcon size={28} />
          {m.body && <div className="message-caption">{m.body}</div>}
        </div>
      );
    case "file":
      return (
        <div className="message-media message-media-file">
          <FileIcon size={20} />
          <span>{m.mediaName ?? "File"}</span>
        </div>
      );
    case "voice":
      return (
        <div className="message-media message-media-voice">
          <button className="voice-play" type="button" aria-label="Play voice message">
            <PlayIcon size={14} />
          </button>
          <div className="voice-waveform" />
          <span className="voice-duration">
            0:{String(m.durationSec ?? 0).padStart(2, "0")}
          </span>
        </div>
      );
    default:
      return <div className="message-body">{m.body}</div>;
  }
}

export function MessageBubble({
  message,
  showSender,
  onReact,
  onToggleStar,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  message: Message;
  showSender?: boolean;
  onReact: (emoji: string) => void;
  onToggleStar: () => void;
  onTogglePin: () => void;
  onEdit?: (text: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.body);

  // WhatsApp only lets you edit/delete your own messages, and only edit plain text (not
  // media captions) — mirrored here rather than just relying on the backend to reject it.
  const canEdit = message.fromMe && message.type === "text" && Boolean(onEdit);
  const canDelete = message.fromMe && Boolean(onDelete);

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.body) onEdit?.(trimmed);
    setEditing(false);
  }

  return (
    <div className={message.fromMe ? "message message-mine" : "message"}>
      <MessageActions
        message={message}
        onReact={onReact}
        onToggleStar={onToggleStar}
        onTogglePin={onTogglePin}
        onEdit={canEdit ? () => setEditing(true) : undefined}
        onDelete={canDelete ? onDelete : undefined}
      />
      {showSender && message.senderName && (
        <div className="message-sender">{message.senderName}</div>
      )}
      {message.pinned && (
        <div className="message-pinned-badge">
          <PinIcon size={11} /> Pinned
        </div>
      )}
      {editing ? (
        <form className="message-edit-form" onSubmit={submitEdit}>
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditText(message.body);
                setEditing(false);
              }
            }}
          />
          <div>
            <button type="submit">Save</button>
            <button
              type="button"
              onClick={() => {
                setEditText(message.body);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <MessageContent m={message} />
      )}
      <div className="message-meta">
        {message.starred && <StarIcon size={12} filled className="message-star-badge" />}
        <span className="message-time">{formatClockTime(message.timestamp)}</span>
        {message.fromMe && <StatusTicks status={message.status} />}
      </div>
      {message.reaction && <div className="message-reaction-badge">{message.reaction}</div>}
    </div>
  );
}
