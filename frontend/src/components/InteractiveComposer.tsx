import { useState, type FormEvent } from "react";
import type { ListSection, MessageButton } from "../api.js";
import { BUTTONS_MAX } from "../api.js";
import { TrashIcon } from "./icons.js";

type Mode = "buttons" | "list";

/** New interactive-message modal (WhatsApp Business–style quick-reply buttons or a tappable
 *  list) — same overlay/card pattern as `PollComposer`. Row/button ids are generated here rather
 *  than asked of the user (they're internal plumbing WAHA needs for the reply payload, not
 *  something worth a form field) — kept unique via the row's index, which is stable enough for
 *  a message that's about to be sent once and not edited afterward. Single-section list only
 *  (no multi-section UI): the common case for a personal client is one flat set of options, and
 *  this is already the lowest-priority item on the coverage doc's remaining-gaps list. */
export function InteractiveComposer({
  onSendButtons,
  onSendList,
  onClose,
}: {
  onSendButtons: (body: string, buttons: MessageButton[], footer?: string) => void;
  onSendList: (body: string, buttonText: string, sections: ListSection[], footer?: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("buttons");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttonTexts, setButtonTexts] = useState(["", ""]);
  const [listButtonText, setListButtonText] = useState("View options");
  const [rows, setRows] = useState([{ title: "", description: "" }]);

  const trimmedButtons = buttonTexts.map((t) => t.trim()).filter(Boolean);
  const trimmedRows = rows.map((r) => ({ ...r, title: r.title.trim() })).filter((r) => r.title);

  const canSubmit =
    body.trim().length > 0 &&
    (mode === "buttons"
      ? trimmedButtons.length >= 1 && trimmedButtons.length <= BUTTONS_MAX
      : trimmedRows.length >= 1 && listButtonText.trim().length > 0);

  function updateButton(i: number, value: string) {
    setButtonTexts((bs) => bs.map((b, idx) => (idx === i ? value : b)));
  }

  function addButton() {
    if (buttonTexts.length < BUTTONS_MAX) setButtonTexts((bs) => [...bs, ""]);
  }

  function removeButton(i: number) {
    if (buttonTexts.length > 1) setButtonTexts((bs) => bs.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: "title" | "description", value: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, { title: "", description: "" }]);
  }

  function removeRow(i: number) {
    if (rows.length > 1) setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (mode === "buttons") {
      onSendButtons(
        body.trim(),
        trimmedButtons.map((text, i) => ({ id: `btn${i + 1}`, text })),
        footer.trim() || undefined,
      );
    } else {
      onSendList(
        body.trim(),
        listButtonText.trim(),
        [
          {
            title: "Options",
            rows: trimmedRows.map((r, i) => ({
              rowId: `row${i + 1}`,
              title: r.title,
              description: r.description.trim() || undefined,
            })),
          },
        ],
        footer.trim() || undefined,
      );
    }
    onClose();
  }

  return (
    <div className="contact-picker-overlay" onClick={onClose}>
      <form className="poll-composer" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="contact-picker-title">Interactive message</div>
        <div className="sidebar-filters">
          <button
            type="button"
            className={mode === "buttons" ? "filter-tab active" : "filter-tab"}
            onClick={() => setMode("buttons")}
          >
            Buttons
          </button>
          <button
            type="button"
            className={mode === "list" ? "filter-tab active" : "filter-tab"}
            onClick={() => setMode("list")}
          >
            List
          </button>
        </div>
        <input
          autoFocus
          className="poll-composer-question"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message text"
        />
        {mode === "buttons" ? (
          <>
            <ul className="poll-composer-options">
              {buttonTexts.map((text, i) => (
                <li key={i}>
                  <input
                    value={text}
                    onChange={(e) => updateButton(i, e.target.value)}
                    placeholder={`Button ${i + 1}`}
                  />
                  {buttonTexts.length > 1 && (
                    <button
                      type="button"
                      className="poll-composer-remove"
                      aria-label="Remove button"
                      onClick={() => removeButton(i)}
                    >
                      <TrashIcon size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {buttonTexts.length < BUTTONS_MAX && (
              <button type="button" className="poll-composer-add" onClick={addButton}>
                + Add button
              </button>
            )}
          </>
        ) : (
          <>
            <input
              className="poll-composer-question"
              value={listButtonText}
              onChange={(e) => setListButtonText(e.target.value)}
              placeholder="Button text (e.g. View options)"
            />
            <ul className="poll-composer-options">
              {rows.map((row, i) => (
                <li key={i}>
                  <input
                    value={row.title}
                    onChange={(e) => updateRow(i, "title", e.target.value)}
                    placeholder={`Option ${i + 1}`}
                  />
                  <input
                    value={row.description}
                    onChange={(e) => updateRow(i, "description", e.target.value)}
                    placeholder="Description (optional)"
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="poll-composer-remove"
                      aria-label="Remove option"
                      onClick={() => removeRow(i)}
                    >
                      <TrashIcon size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" className="poll-composer-add" onClick={addRow}>
              + Add option
            </button>
          </>
        )}
        <input
          className="poll-composer-question"
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          placeholder="Footer (optional)"
        />
        <button type="submit" className="new-chat-btn" disabled={!canSubmit}>
          Send {mode === "buttons" ? "buttons" : "list"}
        </button>
        <button type="button" className="contact-picker-close" onClick={onClose}>
          Cancel
        </button>
      </form>
    </div>
  );
}
