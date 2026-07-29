import type { ChangeEvent, FormEvent } from "react";
import { useRef } from "react";
import type { OutgoingFile } from "../api.js";
import { FileIcon, MicIcon, PaperclipIcon, SendIcon, SmileIcon } from "./icons.js";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function Composer({
  value,
  onChange,
  onSend,
  onSendImage,
  onSendVideo,
  onSendFile,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onSendImage: (file: OutgoingFile) => void;
  onSendVideo: (file: OutgoingFile) => void;
  onSendFile: (file: OutgoingFile) => void;
}) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value);
  }

  // One picker for image + video, dispatched by mimetype — same upload UX WhatsApp itself
  // uses ("Photos & videos" is a single option in its attach menu).
  async function handleMediaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const data = await fileToBase64(file);
    const outgoing: OutgoingFile = { mimetype: file.type || "image/jpeg", filename: file.name, data };
    if (file.type.startsWith("video/")) onSendVideo(outgoing);
    else onSendImage(outgoing);
  }

  async function handleDocChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const data = await fileToBase64(file);
    onSendFile({ mimetype: file.type || "application/octet-stream", filename: file.name, data });
  }

  return (
    <form className="composer" onSubmit={submit}>
      <button type="button" className="composer-icon-btn" aria-label="Emoji" title="Emoji">
        <SmileIcon size={22} />
      </button>
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="composer-file-input"
        onChange={handleMediaChange}
      />
      <button
        type="button"
        className="composer-icon-btn"
        aria-label="Attach photo or video"
        title="Attach photo or video"
        onClick={() => mediaInputRef.current?.click()}
      >
        <PaperclipIcon size={21} />
      </button>
      <input
        ref={docInputRef}
        type="file"
        className="composer-file-input"
        onChange={handleDocChange}
      />
      <button
        type="button"
        className="composer-icon-btn"
        aria-label="Attach document"
        title="Attach document"
        onClick={() => docInputRef.current?.click()}
      >
        <FileIcon size={19} />
      </button>
      <input
        className="composer-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a message"
      />
      <button
        type="submit"
        className="composer-send-btn"
        aria-label={value.trim() ? "Send" : "Record voice message"}
        title={value.trim() ? "Send" : "Record voice message"}
      >
        {value.trim() ? <SendIcon size={20} /> : <MicIcon size={20} />}
      </button>
    </form>
  );
}
