import { useState, type FormEvent } from "react";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "../api.js";
import { TrashIcon } from "./icons.js";

/** New-poll modal — same overlay/card pattern as `ContactPicker`. WhatsApp allows 2-12 options
 *  per poll (mirrors the backend's `isValidPollOptions`); this component enforces the same
 *  range client-side so a bad submission never round-trips to get rejected. */
export function PollComposer({
  onSubmit,
  onClose,
}: {
  onSubmit: (name: string, options: string[], multipleAnswers: boolean) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleAnswers, setMultipleAnswers] = useState(false);

  const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
  const canSubmit =
    name.trim().length > 0 &&
    trimmedOptions.length >= POLL_MIN_OPTIONS &&
    trimmedOptions.length <= POLL_MAX_OPTIONS;

  function updateOption(i: number, value: string) {
    setOptions((opts) => opts.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    if (options.length < POLL_MAX_OPTIONS) setOptions((opts) => [...opts, ""]);
  }

  function removeOption(i: number) {
    if (options.length > POLL_MIN_OPTIONS) setOptions((opts) => opts.filter((_, idx) => idx !== i));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(name.trim(), trimmedOptions, multipleAnswers);
    onClose();
  }

  return (
    <div className="contact-picker-overlay" onClick={onClose}>
      <form className="poll-composer" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="contact-picker-title">New poll</div>
        <input
          autoFocus
          className="poll-composer-question"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ask a question"
        />
        <ul className="poll-composer-options">
          {options.map((opt, i) => (
            <li key={i}>
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              {options.length > POLL_MIN_OPTIONS && (
                <button
                  type="button"
                  className="poll-composer-remove"
                  aria-label="Remove option"
                  onClick={() => removeOption(i)}
                >
                  <TrashIcon size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {options.length < POLL_MAX_OPTIONS && (
          <button type="button" className="poll-composer-add" onClick={addOption}>
            + Add option
          </button>
        )}
        <label className="poll-composer-multi">
          <input
            type="checkbox"
            checked={multipleAnswers}
            onChange={(e) => setMultipleAnswers(e.target.checked)}
          />
          Allow multiple answers
        </label>
        <button type="submit" className="new-chat-btn" disabled={!canSubmit}>
          Create poll
        </button>
        <button type="button" className="contact-picker-close" onClick={onClose}>
          Cancel
        </button>
      </form>
    </div>
  );
}
