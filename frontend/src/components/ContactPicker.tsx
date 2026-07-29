import { useEffect, useMemo, useState } from "react";
import { api, type Contact } from "../api.js";
import { Avatar } from "./Avatar.js";
import { SearchIcon } from "./icons.js";

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "#";
}

/** Shared "pick a contact" popover — backs both starting a new chat and sharing a contact card.
 *  Self-contained (fetches its own data), same pattern as `LabelsMenu`. */
export function ContactPicker({
  title,
  onSelect,
  onClose,
}: {
  title: string;
  onSelect: (contact: Contact) => void;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listContacts()
      .then(setContacts)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.pushname, c.number].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [contacts, query]);

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
                <button type="button" className="contact-picker-item" onClick={() => onSelect(c)}>
                  <Avatar initials={initials(name)} color="#64748b" size={36} />
                  <div className="contact-picker-item-body">
                    <span className="contact-picker-item-name">{name}</span>
                    {c.number && <span className="contact-picker-item-number">{c.number}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="contact-picker-close" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
