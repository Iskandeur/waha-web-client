import { useState } from "react";
import { api } from "../api.js";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Paste-a-link (or bare code) flow for `groups/join` — the one group-membership action that
 *  isn't reachable from a chat you're already in. Previews the group via `join-info` before
 *  committing, same "look before you leap" shape as `handleStartNewChat`'s number check. */
export function JoinGroupModal({
  onJoined,
  onClose,
}: {
  onJoined: (groupId: string) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ subject?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function extractCode(input: string): string {
    const match = input.trim().match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    return match ? match[1] : input.trim();
  }

  async function preview_() {
    const c = extractCode(code);
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const info = await api.getGroupJoinInfo(c);
      setPreview(info);
    } catch (err) {
      setError(errorMessage(err));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    const c = extractCode(code);
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.joinGroup(c);
      onJoined(result.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contact-picker-overlay" onClick={onClose}>
      <div className="contact-picker" onClick={(e) => e.stopPropagation()}>
        <div className="contact-picker-title">Join a group</div>
        <form
          className="labels-menu-add"
          onSubmit={(e) => {
            e.preventDefault();
            preview_();
          }}
        >
          <input
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setPreview(null);
            }}
            placeholder="Invite link or code"
          />
          <button type="submit" disabled={!code.trim() || busy}>
            Preview
          </button>
        </form>
        {error && <div className="contact-picker-error">{error}</div>}
        {preview && (
          <div className="new-group-participants">
            Group: {preview.subject ?? "(no subject)"}
          </div>
        )}
        <button type="button" className="new-chat-btn" disabled={!code.trim() || busy} onClick={join}>
          {busy ? "Joining…" : "Join group"}
        </button>
        <button type="button" className="contact-picker-close" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
