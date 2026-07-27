import { useState } from "react";

export function Composer({
  value,
  onSend,
}: {
  value?: string;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState(value ?? "");

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSend(text);
        setText("");
      }}
    >
      <input
        className="composer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message"
      />
      <button type="submit">Send</button>
    </form>
  );
}
