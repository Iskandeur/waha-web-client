import { useEffect, useMemo, useState } from "react";
import { api, type Contact } from "../api.js";
import { Avatar } from "./Avatar.js";
import { CheckIcon, SearchIcon } from "./icons.js";

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "#";
}

/** Shared "pick a contact" popover — backs starting a new chat, sharing a contact card, and
 *  (in multi-select mode) building a participant list for group creation/add-members. Self-
 *  contained (fetches its own data), same pattern as `LabelsMenu`. Pass `onSelectMultiple`
 *  instead of `onSelect` to switch into checkbox mode with a confirm button. */
export function ContactPicker({
  title,
  onSelect,
  onSelectMultiple,
  onClose,
  excludeIds,
  confirmLabel = "Add",
}: {
  title: string;
  onSelect?: (contact: Contact) => void;
  onSelectMultiple?: (contacts: Contact[]) => void;
  onClose: () => void;
  excludeIds?: string[];
  confirmLabel?: string;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const multi = Boolean(onSelectMultiple);

  useEffect(() => {
    api
      .listContacts()
      .then(setContacts)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => !excludeIds?.includes(c.id))
      .filter((c) =>
        q ? [c.name, c.pushname, c.number].some((f) => f?.toLowerCase().includes(q)) : true,
      );
  }, [contacts, query, excludeIds]);

  function toggle(id: string) {
    setSelected((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  function confirmMultiple() {
    const picked = contacts.filter((c) => selected.includes(c.id));
    onSelectMultiple?.(picked);
  }

  return (
    <div className="contact-picker-overlay" onClick={onClose}>
      <div className="contact-picker" onClick={(e) => e.stopPropagation()}>
        <div className="contact-picker-title">{title}</div>
        <div className="contact-picker-search">
          <SearchIcon size={15} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts"
          />
        </div>
        {error && <div className="contact-picker-error">{error}</div>}
        {loading && <div className="contact-picker-empty">Loading contacts…</div>}
        {!loading && visible.length === 0 && !error && (
          <div className="contact-picker-empty">No contacts match.</div>
        )}
        <ul className="contact-picker-list">
          {visible.map((c) => {
            const name = c.name || c.pushname || c.number || c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="contact-picker-item"
                  onClick={() => (multi ? toggle(c.id) : onSelect?.(c))}
                >
                  <Avatar initials={initials(name)} color="#64748b" size={36} />
                  <div className="contact-picker-item-body">
                    <span className="contact-picker-item-name">{name}</span>
                    {c.number && <span className="contact-picker-item-number">{c.number}</span>}
                  </div>
                  {multi && selected.includes(c.id) && (
                    <CheckIcon size={16} className="contact-picker-item-check" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {multi && (
          <button
            type="button"
            className="new-chat-btn"
            disabled={selected.length === 0}
            onClick={confirmMultiple}
          >
            {confirmLabel} {selected.length > 0 ? `(${selected.length})` : ""}
          </button>
        )}
        <button type="button" className="contact-picker-close" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
