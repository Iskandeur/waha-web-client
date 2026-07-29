import { useState } from "react";
import { api, type Contact } from "../api.js";
import { ContactPicker } from "./ContactPicker.js";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Two-step "New group" flow: pick participants, then name the group. Self-contained (owns its
 *  own step state), same pattern as the other popovers — calls `onCreated` with the new
 *  group's chatId so the caller can select it, mirroring `handleStartNewChatFromContact`. */
export function NewGroupFlow({
  onCreated,
  onClose,
}: {
  onCreated: (groupId: string, name: string) => void;
  onClose: () => void;
}) {
  const [participants, setParticipants] = useState<Contact[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!participants) {
    return (
      <ContactPicker
        title="New group — add participants"
        onSelectMultiple={(contacts) => {
          if (contacts.length === 0) return;
          setParticipants(contacts);
        }}
        onClose={onClose}
        confirmLabel="Next"
      />
    );
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const group = await api.createGroup(
        trimmed,
        (participants ?? []).map((c) => c.id),
      );
      onCreated(group.id, trimmed);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="contact-picker-overlay" onClick={onClose}>
      <div className="contact-picker" onClick={(e) => e.stopPropagation()}>
        <div className="contact-picker-title">Name your group</div>
        <div className="new-group-participants">
          {participants.length} participant{participants.length === 1 ? "" : "s"} selected
        </div>
        <form
          className="labels-menu-add"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={100}
          />
        </form>
        {error && <div className="contact-picker-error">{error}</div>}
        <button type="button" className="new-chat-btn" disabled={!name.trim() || creating} onClick={submit}>
          {creating ? "Creating…" : "Create group"}
        </button>
        <button type="button" className="contact-picker-close" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
