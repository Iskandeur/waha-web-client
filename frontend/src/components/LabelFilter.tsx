import { useEffect, useState } from "react";
import { api, type Label } from "../api.js";
import { TagIcon } from "./icons.js";

/** Chat-list "filter by label" popover — sibling to `LabelsMenu` (which assigns labels to one
 *  chat) but scoped to picking a label to filter the whole list by, backed by the already-wired
 *  `GET /api/labels/:id/chats` (`waha.getChatsByLabel`, done since the labels pass but never had
 *  a UI slot until now). Self-contained (fetches its own label list), same pattern as
 *  `ContactPicker`/`LabelsMenu`. */
export function LabelFilter({
  activeLabelId,
  onSelect,
}: {
  activeLabelId: string | null;
  onSelect: (labelId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    api.listLabels().then(setLabels).catch(() => undefined);
  }, []);

  const activeLabel = labels.find((l) => l.id === activeLabelId);

  return (
    <div className="label-filter">
      <button
        type="button"
        className={activeLabelId ? "filter-tab active label-filter-btn" : "filter-tab label-filter-btn"}
        onClick={() => setOpen((v) => !v)}
        aria-label="Filter by label"
        title="Filter by label"
      >
        <TagIcon size={13} />
        {activeLabel ? activeLabel.name : "Labels"}
      </button>
      {open && (
        <div className="label-filter-dropdown">
          <button
            type="button"
            className="label-filter-option"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
          >
            All labels
          </button>
          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              className="label-filter-option"
              onClick={() => {
                onSelect(label.id);
                setOpen(false);
              }}
            >
              <span className="labels-menu-swatch" style={{ background: label.colorHex }} />
              {label.name}
            </button>
          ))}
          {labels.length === 0 && <div className="label-filter-empty">No labels yet</div>}
        </div>
      )}
    </div>
  );
}
