import type { Message } from "../api.js";

export function ChatThread({ messages }: { messages: Message[] }) {
  return (
    <div className="chat-thread">
      {messages.map((m) => (
        <div key={m.id} className={m.fromMe ? "message message-mine" : "message"}>
          <div className="message-body">{m.body}</div>
        </div>
      ))}
    </div>
  );
}
