import { useEffect, useState } from "react";
import { api, type Chat, type Contact } from "../api.js";
import { useEscapeToClose } from "../useEscapeToClose.js";
import { Avatar } from "./Avatar.js";
import { ShieldIcon, XIcon } from "./icons.js";

function shortId(id: string): string {
  return id.replace(/@.*$/, "");
}

/** The missing UI slot flagged since the v9 pass: gives `GET contacts/{id}` (single-contact
 *  lookup) and `GET contacts/about` somewhere to render, and lets `isBlocked` show up next to
 *  the info it's actually about rather than only living in `ChatHeader`'s menu. Self-contained
 *  (fetches its own data), same pattern as `GroupPanel`/`LabelsMenu`; reuses the `group-panel-*`
 *  layout classes rather than inventing a near-identical stylesheet for a second side panel. */
export function ContactDetailPanel({
  chat,
  onClose,
  onToggleBlock,
}: {
  chat: Chat;
  onClose: () => void;
  onToggleBlock: () => void;
}) {
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [about, setAbout] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(onClose);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getChatPicture(chat.id)
      .then((res) => setPictureUrl(res.url))
      .catch(() => setPictureUrl(null));
    Promise.all([api.getContact(chat.id), api.getContactAbout(chat.id)])
      .then(([c, a]) => {
        setContact(c);
        setAbout(a.about);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [chat.id]);

  const number = contact?.number || shortId(chat.id);

  return (
    <div className="group-panel-overlay" onClick={onClose}>
      <div className="group-panel" onClick={(e) => e.stopPropagation()}>
        <div className="group-panel-header">
          <div>Contact info</div>
          <button type="button" className="group-panel-close" aria-label="Close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        {error && <div className="group-panel-error">{error}</div>}
        <div className="group-panel-body">
          <div className="group-panel-picture">
            <Avatar initials={chat.avatarInitials} color={chat.avatarColor} size={96} src={pictureUrl} />
          </div>
          <div className="group-panel-field">
            <div className="group-panel-field-label">Name</div>
            <div className="group-panel-field-value">{chat.name}</div>
          </div>
          <div className="group-panel-field">
            <div className="group-panel-field-label">Number</div>
            <div className="group-panel-field-value">{number}</div>
          </div>
          <div className="group-panel-field">
            <div className="group-panel-field-label">About</div>
            <div className="group-panel-field-value">
              {loading ? "Loading…" : (about ?? "No about info shared")}
            </div>
          </div>
          {!loading && (
            <div className="group-panel-field">
              <div className="group-panel-field-label">In your contacts</div>
              <div className="group-panel-field-value">
                {contact?.isMyContact ? "Yes" : "No — this is a WhatsApp id, not a saved contact"}
              </div>
            </div>
          )}
          <div className="group-panel-danger">
            <button
              type="button"
              className={chat.isBlocked ? undefined : "group-panel-menu-danger"}
              onClick={onToggleBlock}
            >
              <ShieldIcon size={16} />
              {chat.isBlocked ? "Unblock contact" : "Block contact"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
