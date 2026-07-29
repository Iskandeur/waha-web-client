import type { ChangeEvent, FormEvent } from "react";
import { useRef } from "react";
import type { OutgoingFile } from "../api.js";
import { MicIcon, PaperclipIcon, SendIcon, SmileIcon } from "./icons.js";

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
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onSendImage: (file: OutgoingFile) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value);
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const data = await fileToBase64(file);
    onSendImage({ mimetype: file.type || "image/jpeg", filename: file.name, data });
  }

  return (
    <form className="composer" onSubmit={submit}>
      <button type="button" className="composer-icon-btn" aria-label="Emoji" title="Emoji">
        <SmileIcon size={22} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="composer-file-input"
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="composer-icon-btn"
        aria-label="Attach image"
        title="Attach image"
        onClick={() => fileInputRef.current?.click()}
      >
        <PaperclipIcon size={21} />
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
