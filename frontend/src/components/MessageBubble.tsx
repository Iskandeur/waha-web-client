import { useState, type FormEvent } from "react";
import type { Message } from "../api.js";
import { formatClockTime } from "../format.js";
import { StatusTicks } from "./StatusTicks.js";
import { MessageActions } from "./MessageActions.js";
import {
  CheckIcon,
  FileIcon,
  ImageIcon,
  MapPinIcon,
  PinIcon,
  PlayIcon,
  StarIcon,
  UserIcon,
} from "./icons.js";

function MessageContent({ m, onVotePoll }: { m: Message; onVotePoll?: (votes: string[]) => void }) {
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
    case "location":
      return (
        <a
          className="message-media message-media-location"
          href={
            m.latitude !== undefined && m.longitude !== undefined
              ? `https://www.openstreetmap.org/?mlat=${m.latitude}&mlon=${m.longitude}#map=16/${m.latitude}/${m.longitude}`
              : undefined
          }
          target="_blank"
          rel="noreferrer"
        >
          <MapPinIcon size={20} />
          <span>{m.locationName || "Shared location"}</span>
        </a>
      );
    case "contact":
      return (
        <div className="message-media message-media-contact">
          <UserIcon size={20} />
          <div>
            <div className="message-contact-name">{m.contactName || "Contact"}</div>
            {m.contactNumber && <div className="message-contact-number">{m.contactNumber}</div>}
          </div>
        </div>
      );
    case "voice":
      return m.mediaUrl ? (
        <div className="message-media message-media-voice message-media-voice-real">
          <audio src={m.mediaUrl} controls className="voice-audio" />
        </div>
      ) : (
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
    case "poll":
      return <PollContent m={m} onVotePoll={onVotePoll} />;
    case "buttons":
      return (
        <div className="message-media message-media-buttons">
          <div className="message-body">{m.body}</div>
          {m.footer && <div className="message-interactive-footer">{m.footer}</div>}
          <div className="message-interactive-buttons">
            {(m.buttons ?? []).map((b) => (
              <button key={b.id} type="button" className="message-interactive-button" disabled>
                {b.text}
              </button>
            ))}
          </div>
        </div>
      );
    case "list":
      return (
        <div className="message-media message-media-list">
          <div className="message-body">{m.body}</div>
          {m.footer && <div className="message-interactive-footer">{m.footer}</div>}
          {(m.listSections ?? []).map((section) => (
            <div key={section.title} className="message-list-section">
              <div className="message-list-section-title">{section.title}</div>
              {section.rows.map((row) => (
                <div key={row.rowId} className="message-list-row">
                  <div className="message-list-row-title">{row.title}</div>
                  {row.description && (
                    <div className="message-list-row-description">{row.description}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
          <button type="button" className="message-interactive-button" disabled>
            {m.listButtonText || "View options"}
          </button>
        </div>
      );
    default:
      return <div className="message-body">{m.body}</div>;
  }
}

/** WAHA gives us vote *events*, not a server-computed tally, so counting is a client concern
 *  here — same reasoning as the demo's `votePoll`. This component has no notion of "my own
 *  JID" (that would need an extra profile fetch per bubble), so selection is tracked as local
 *  UI state rather than derived from `votes` containing "me"; the vote counts themselves
 *  (`option.votes.length`) still reflect real server/demo state after each reload. */
function PollContent({ m, onVotePoll }: { m: Message; onVotePoll?: (votes: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const options = m.pollOptions ?? [];

  function toggle(name: string) {
    const next = m.pollMultipleAnswers
      ? selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name]
      : selected.includes(name)
        ? []
        : [name];
    setSelected(next);
    onVotePoll?.(next);
  }

  return (
    <div className="message-media message-media-poll">
      <div className="poll-question">{m.pollName || m.body}</div>
      <ul className="poll-options">
        {options.map((opt) => (
          <li key={opt.name}>
            <button
              type="button"
              className="poll-option"
              disabled={!onVotePoll}
              onClick={() => toggle(opt.name)}
            >
              <span className="poll-option-check">
                {selected.includes(opt.name) && <CheckIcon size={14} />}
              </span>
              <span className="poll-option-name">{opt.name}</span>
              <span className="poll-option-votes">{opt.votes.length || ""}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="poll-footer">
        {m.pollMultipleAnswers ? "Select one or more" : "Select one"}
      </div>
    </div>
  );
}

export function MessageBubble({
  message,
  showSender,
  onReact,
  onToggleStar,
  onTogglePin,
  onEdit,
  onDelete,
  onVotePoll,
}: {
  message: Message;
  showSender?: boolean;
  onReact: (emoji: string) => void;
  onToggleStar: () => void;
  onTogglePin: () => void;
  onEdit?: (text: string) => void;
  onDelete?: () => void;
  onVotePoll?: (votes: string[]) => void;
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
        <MessageContent m={message} onVotePoll={onVotePoll} />
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
