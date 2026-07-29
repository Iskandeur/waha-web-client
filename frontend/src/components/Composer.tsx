import type { FormEvent } from "react";
import { MicIcon, PaperclipIcon, SendIcon, SmileIcon } from "./icons.js";

export function Composer({
  value,
  onChange,
  onSend,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value);
  }

  return (
    <form className="composer" onSubmit={submit}>
      <button type="button" className="composer-icon-btn" aria-label="Emoji" title="Emoji">
        <SmileIcon size={22} />
      </button>
      <button type="button" className="composer-icon-btn" aria-label="Attach" title="Attach">
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
