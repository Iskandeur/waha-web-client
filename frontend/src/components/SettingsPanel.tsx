import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { api, type Profile } from "../api.js";
import { Avatar } from "./Avatar.js";
import { CameraIcon, PencilIcon, TrashIcon, XIcon } from "./icons.js";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Own-account settings: name/about/avatar. Self-contained (fetches its own profile), same
 *  pattern as `GroupPanel`. WAHA's `GET profile` has no "about"/status field to read back — the
 *  status field here is write-only (matches `docs/waha-coverage.md`'s note on `MyProfile`), so
 *  it starts blank rather than pretending to show a current value we don't have. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [status, setStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const pictureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getProfile()
      .then(setProfile)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function flashSaved(note: string) {
    setSavedNote(note);
    setTimeout(() => setSavedNote(null), 2000);
  }

  async function saveName() {
    const name = nameDraft.trim();
    if (!name || !profile) {
      setEditingName(false);
      return;
    }
    try {
      await api.setProfileName(name);
      setProfile({ ...profile, name });
      setEditingName(false);
      flashSaved("Name updated");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveStatus() {
    setSavingStatus(true);
    try {
      await api.setProfileStatus(status);
      flashSaved("About updated");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingStatus(false);
    }
  }

  async function handlePictureFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    try {
      const data = await fileToBase64(file);
      await api.setProfilePicture({ mimetype: file.type || "image/jpeg", data });
      setProfile({ ...profile, picture: `data:${file.type || "image/jpeg"};base64,${data}` });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDeletePicture() {
    if (!profile) return;
    try {
      await api.deleteProfilePicture();
      setProfile({ ...profile, picture: null });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="group-panel-overlay" onClick={onClose}>
      <div className="group-panel" onClick={(e) => e.stopPropagation()}>
        <div className="group-panel-header">
          <span>Settings</span>
          <button type="button" className="group-panel-close" aria-label="Close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>

        {error && <div className="group-panel-error">{error}</div>}
        {savedNote && <div className="group-panel-saved">{savedNote}</div>}

        {!profile ? (
          <div className="group-panel-empty">Loading…</div>
        ) : (
          <div className="group-panel-body">
            <div className="group-panel-picture">
              <Avatar initials={profile.name.slice(0, 1).toUpperCase() || "#"} color="#0ea5a4" size={72} src={profile.picture} />
              <input
                ref={pictureInputRef}
                type="file"
                accept="image/*"
                className="composer-file-input"
                onChange={handlePictureFile}
              />
              <div className="group-panel-picture-actions">
                <button type="button" onClick={() => pictureInputRef.current?.click()}>
                  <CameraIcon size={14} /> Change
                </button>
                {profile.picture && (
                  <button type="button" onClick={handleDeletePicture}>
                    <TrashIcon size={14} /> Remove
                  </button>
                )}
              </div>
            </div>

            <div className="group-panel-field">
              <div className="group-panel-field-label">Name</div>
              {editingName ? (
                <form
                  className="group-panel-edit-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveName();
                  }}
                >
                  <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={100} />
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditingName(false)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="group-panel-field-value">
                  <span>{profile.name}</span>
                  <button
                    type="button"
                    aria-label="Edit name"
                    onClick={() => {
                      setNameDraft(profile.name);
                      setEditingName(true);
                    }}
                  >
                    <PencilIcon size={13} />
                  </button>
                </div>
              )}
            </div>

            <div className="group-panel-field">
              <div className="group-panel-field-label">About</div>
              <form
                className="group-panel-edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveStatus();
                }}
              >
                <input
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Hey there! I am using WhatsApp"
                  maxLength={140}
                />
                <button type="submit" disabled={savingStatus}>
                  Save
                </button>
              </form>
            </div>

            <div className="group-panel-field">
              <div className="group-panel-field-label">Number</div>
              <div className="group-panel-field-value">
                <span>{profile.id.replace(/@.*$/, "")}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
