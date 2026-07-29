import type { Message } from "../api.js";
import { formatClockTime } from "../format.js";
import { StatusTicks } from "./StatusTicks.js";
import { FileIcon, ImageIcon, PlayIcon } from "./icons.js";

function MessageContent({ m }: { m: Message }) {
  switch (m.type) {
    case "image":
      return (
        <div className="message-media message-media-image">
          <ImageIcon size={28} />
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
}: {
  message: Message;
  showSender?: boolean;
}) {
  return (
    <div className={message.fromMe ? "message message-mine" : "message"}>
      {showSender && message.senderName && (
        <div className="message-sender">{message.senderName}</div>
      )}
      <MessageContent m={message} />
      <div className="message-meta">
        <span className="message-time">{formatClockTime(message.timestamp)}</span>
        {message.fromMe && <StatusTicks status={message.status} />}
      </div>
    </div>
  );
}
