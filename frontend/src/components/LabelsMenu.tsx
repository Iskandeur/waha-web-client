import { useEffect, useState } from "react";
import { api, type Label } from "../api.js";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons.js";

/** A small curated swatch set (WhatsApp Business ships ~20 label colors; this is a practical
 *  subset) — `color` is the number WAHA stores, `colorHex` is what the UI renders. */
const LABEL_PALETTE: { color: number; colorHex: string }[] = [
  { color: 0, colorHex: "#ff9485" },
  { color: 1, colorHex: "#54c9c2" },
  { color: 2, colorHex: "#89c9ff" },
  { color: 3, colorHex: "#e2b4ff" },
  { color: 4, colorHex: "#fdd663" },
  { color: 5, colorHex: "#8bcf8f" },
  { color: 6, colorHex: "#f39bd0" },
  { color: 7, colorHex: "#8696a0" },
];

/** Popover for viewing/creating/assigning labels on the open chat — self-contained (fetches
 *  its own data) rather than threading label state through App.tsx, since no other screen
 *  needs it yet. Assigning is optimistic; a failed toggle reverts. */
export function LabelsMenu({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [chatLabelIds, setChatLabelIds] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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

  function startEdit(label: Label) {
    setEditingId(label.id);
    setEditName(label.name);
  }

  async function saveEdit(label: Label, color?: number, colorHex?: string) {
    const name = editName.trim() || label.name;
    try {
      const updated = await api.updateLabel(label.id, name, color ?? label.color, colorHex ?? label.colorHex);
      setAllLabels((ls) => ls.map((l) => (l.id === label.id ? updated : l)));
      if (color === undefined) setEditingId(null);
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
            {editingId === label.id ? (
              <form
                className="labels-menu-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit(label);
                }}
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={40}
                />
                <div className="labels-menu-palette">
                  {LABEL_PALETTE.map((swatch) => (
                    <button
                      key={swatch.color}
                      type="button"
                      className="labels-menu-swatch-btn"
                      aria-label={`Set color ${swatch.color}`}
                      style={{ background: swatch.colorHex }}
                      onClick={() => saveEdit(label, swatch.color, swatch.colorHex)}
                    />
                  ))}
                </div>
                <div className="labels-menu-edit-actions">
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className="labels-menu-toggle"
                  onClick={() => toggle(label.id)}
                >
                  <span className="labels-menu-swatch" style={{ background: label.colorHex }} />
                  <span className="labels-menu-name">{label.name}</span>
                  {chatLabelIds.includes(label.id) && <CheckIcon size={15} />}
                </button>
                <button
                  type="button"
                  className="labels-menu-edit-btn"
                  aria-label={`Rename or recolor ${label.name}`}
                  onClick={() => startEdit(label)}
                >
                  <PencilIcon size={13} />
                </button>
                <button
                  type="button"
                  className="labels-menu-remove"
                  aria-label={`Delete label ${label.name}`}
                  onClick={() => removeLabel(label.id)}
                >
                  <TrashIcon size={14} />
                </button>
              </>
            )}
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
