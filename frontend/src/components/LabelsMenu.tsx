import { useEffect, useState } from "react";
import { api, type Label } from "../api.js";
import { CheckIcon, PlusIcon, TrashIcon } from "./icons.js";

/** Popover for viewing/creating/assigning labels on the open chat — self-contained (fetches
 *  its own data) rather than threading label state through App.tsx, since no other screen
 *  needs it yet. Assigning is optimistic; a failed toggle reverts. */
export function LabelsMenu({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [chatLabelIds, setChatLabelIds] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listLabels().then(setAllLabels).catch(() => setError("Couldn't load labels"));
    api
      .getChatLabels(chatId)
      .then((labels) => setChatLabelIds(labels.map((l) => l.id)))
      .catch(() => setError("Couldn't load labels"));
  }, [chatId]);

  async function toggle(labelId: string) {
    const has = chatLabelIds.includes(labelId);
    const next = has ? chatLabelIds.filter((id) => id !== labelId) : [...chatLabelIds, labelId];
    const prev = chatLabelIds;
    setChatLabelIds(next);
    try {
      await api.setChatLabels(chatId, next);
    } catch (err) {
      setChatLabelIds(prev);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addLabel() {
    const name = newName.trim();
    if (!name) return;
    try {
      const label = await api.createLabel(name);
      setAllLabels((ls) => [...ls, label]);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeLabel(labelId: string) {
    try {
      await api.deleteLabel(labelId);
      setAllLabels((ls) => ls.filter((l) => l.id !== labelId));
      setChatLabelIds((ids) => ids.filter((id) => id !== labelId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="labels-menu" onClick={(e) => e.stopPropagation()}>
      <div className="labels-menu-title">Labels</div>
      {error && <div className="labels-menu-error">{error}</div>}
      <ul className="labels-menu-list">
        {allLabels.map((label) => (
          <li key={label.id} className="labels-menu-item">
            <button type="button" className="labels-menu-toggle" onClick={() => toggle(label.id)}>
              <span className="labels-menu-swatch" style={{ background: label.colorHex }} />
              <span className="labels-menu-name">{label.name}</span>
              {chatLabelIds.includes(label.id) && <CheckIcon size={15} />}
            </button>
            <button
              type="button"
              className="labels-menu-remove"
              aria-label={`Delete label ${label.name}`}
              onClick={() => removeLabel(label.id)}
            >
              <TrashIcon size={14} />
            </button>
          </li>
        ))}
        {allLabels.length === 0 && <li className="labels-menu-empty">No labels yet</li>}
      </ul>
      <form
        className="labels-menu-add"
        onSubmit={(e) => {
          e.preventDefault();
          addLabel();
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New label"
          maxLength={40}
        />
        <button type="submit" aria-label="Add label">
          <PlusIcon size={16} />
        </button>
      </form>
      <button type="button" className="labels-menu-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
