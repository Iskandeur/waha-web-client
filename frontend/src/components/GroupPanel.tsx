import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { api, type Contact, type GroupParticipant } from "../api.js";
import { useEscapeToClose } from "../useEscapeToClose.js";
import { Avatar } from "./Avatar.js";
import { ContactPicker } from "./ContactPicker.js";
import {
  CameraIcon,
  CheckIcon,
  CopyIcon,
  LinkIcon,
  LogOutIcon,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from "./icons.js";

function initials(text: string): string {
  return text.trim().slice(0, 1).toUpperCase() || "#";
}

function shortId(id: string): string {
  return id.replace(/@.*$/, "");
}

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

/** Full group-management surface — participants, roles, subject/description, invite link, and
 *  security settings — for one group. Self-contained (fetches its own data), same pattern as
 *  `LabelsMenu`/`ContactPicker`. WAHA/WhatsApp enforce the real permission checks (e.g. only
 *  admins can add participants) server-side; a failed call just surfaces via `error` rather
 *  than being pre-guessed and hidden here. */
export function GroupPanel({
  groupId,
  groupName,
  onClose,
  onSubjectChange,
  onLeftOrDeleted,
}: {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onSubjectChange: (subject: string) => void;
  onLeftOrDeleted: () => void;
}) {
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const pictureInputRef = useRef<HTMLInputElement>(null);

  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(groupName);

  const [description, setDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const [infoAdminOnly, setInfoAdminOnly] = useState(false);
  const [messagesAdminOnly, setMessagesAdminOnly] = useState(false);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);

  useEscapeToClose(onClose);

  useEffect(() => {
    setSubjectDraft(groupName);
  }, [groupName]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getGroupParticipants(groupId).then((ps) => !cancelled && setParticipants(ps)),
      api
        .getGroup(groupId)
        .then((g) => !cancelled && setDescription(typeof g.description === "string" ? g.description : "")),
      api.getGroupPicture(groupId).then((r) => !cancelled && setPictureUrl(r.url)),
      api.getGroupInfoAdminOnly(groupId).then((r) => !cancelled && setInfoAdminOnly(r.adminsOnly)),
      api
        .getGroupMessagesAdminOnly(groupId)
        .then((r) => !cancelled && setMessagesAdminOnly(r.adminsOnly)),
    ])
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  async function refreshParticipants() {
    try {
      setParticipants(await api.getGroupParticipants(groupId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveSubject() {
    const subject = subjectDraft.trim();
    if (!subject || subject === groupName) {
      setEditingSubject(false);
      setSubjectDraft(groupName);
      return;
    }
    try {
      await api.setGroupSubject(groupId, subject);
      onSubjectChange(subject);
      setEditingSubject(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function startEditDescription() {
    setDescriptionDraft(description);
    setEditingDescription(true);
  }

  async function saveDescription() {
    try {
      await api.setGroupDescription(groupId, descriptionDraft.trim());
      setDescription(descriptionDraft.trim());
      setEditingDescription(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handlePictureFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await fileToBase64(file);
      await api.setGroupPicture(groupId, { mimetype: file.type || "image/jpeg", data });
      setPictureUrl(`data:${file.type || "image/jpeg"};base64,${data}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDeletePicture() {
    try {
      await api.deleteGroupPicture(groupId);
      setPictureUrl(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function toggleInfoAdminOnly() {
    const next = !infoAdminOnly;
    setInfoAdminOnly(next);
    try {
      await api.setGroupInfoAdminOnly(groupId, next);
    } catch (err) {
      setInfoAdminOnly(!next);
      setError(errorMessage(err));
    }
  }

  async function toggleMessagesAdminOnly() {
    const next = !messagesAdminOnly;
    setMessagesAdminOnly(next);
    try {
      await api.setGroupMessagesAdminOnly(groupId, next);
    } catch (err) {
      setMessagesAdminOnly(!next);
      setError(errorMessage(err));
    }
  }

  async function loadInviteLink() {
    try {
      setInviteCode(await api.getGroupInviteCode(groupId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function regenerateInviteLink() {
    if (!window.confirm("Revoke the current invite link and generate a new one? The old link will stop working.")) {
      return;
    }
    try {
      setInviteCode(await api.revokeGroupInviteCode(groupId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function copyInviteLink() {
    if (!inviteCode) return;
    const link = `https://chat.whatsapp.com/${inviteCode}`;
    navigator.clipboard
      ?.writeText(link)
      .then(() => {
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      })
      .catch(() => undefined);
  }

  async function handleAddParticipants(contacts: Contact[]) {
    setPickerOpen(false);
    if (contacts.length === 0) return;
    try {
      await api.addGroupParticipants(
        groupId,
        contacts.map((c) => c.id),
      );
      await refreshParticipants();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleRemoveParticipant(id: string) {
    if (!window.confirm("Remove this participant from the group?")) return;
    try {
      await api.removeGroupParticipants(groupId, [id]);
      await refreshParticipants();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handlePromote(id: string) {
    try {
      await api.promoteGroupParticipants(groupId, [id]);
      await refreshParticipants();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDemote(id: string) {
    try {
      await api.demoteGroupParticipants(groupId, [id]);
      await refreshParticipants();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleLeave() {
    if (!window.confirm("Leave this group?")) return;
    try {
      await api.leaveGroup(groupId);
      onLeftOrDeleted();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this group for everyone? This can't be undone.")) return;
    try {
      await api.deleteGroup(groupId);
      onLeftOrDeleted();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="group-panel-overlay" onClick={onClose}>
      <div className="group-panel" onClick={(e) => e.stopPropagation()}>
        <div className="group-panel-header">
          <UsersIcon size={18} />
          <span>Group info</span>
          <button type="button" className="group-panel-close" aria-label="Close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>

        {error && <div className="group-panel-error">{error}</div>}

        <div className="group-panel-body">
          <div className="group-panel-picture">
            <Avatar initials={initials(groupName)} color="#aebf92" size={72} src={pictureUrl} />
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
              {pictureUrl && (
                <button type="button" onClick={handleDeletePicture}>
                  <TrashIcon size={14} /> Remove
                </button>
              )}
            </div>
          </div>

          <div className="group-panel-field">
            <div className="group-panel-field-label">Subject</div>
            {editingSubject ? (
              <form
                className="group-panel-edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSubject();
                }}
              >
                <input
                  autoFocus
                  value={subjectDraft}
                  onChange={(e) => setSubjectDraft(e.target.value)}
                  maxLength={100}
                />
                <button type="submit">Save</button>
                <button type="button" onClick={() => { setEditingSubject(false); setSubjectDraft(groupName); }}>
                  Cancel
                </button>
              </form>
            ) : (
              <div className="group-panel-field-value">
                <span>{groupName}</span>
                <button type="button" onClick={() => setEditingSubject(true)} aria-label="Edit subject">
                  <PencilIcon size={13} />
                </button>
              </div>
            )}
          </div>

          <div className="group-panel-field">
            <div className="group-panel-field-label">Description</div>
            {editingDescription ? (
              <form
                className="group-panel-edit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveDescription();
                }}
              >
                <textarea
                  autoFocus
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <button type="submit">Save</button>
                <button type="button" onClick={() => setEditingDescription(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <div className="group-panel-field-value">
                <span>{description || "No description"}</span>
                <button type="button" onClick={startEditDescription} aria-label="Edit description">
                  <PencilIcon size={13} />
                </button>
              </div>
            )}
          </div>

          <div className="group-panel-field">
            <div className="group-panel-field-label">Invite link</div>
            {inviteCode ? (
              <div className="group-panel-invite">
                <code>{`chat.whatsapp.com/${inviteCode}`}</code>
                <button type="button" onClick={copyInviteLink} aria-label="Copy invite link">
                  {inviteCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                </button>
                <button type="button" onClick={regenerateInviteLink} aria-label="Revoke and regenerate">
                  Reset
                </button>
              </div>
            ) : (
              <button type="button" className="group-panel-link-btn" onClick={loadInviteLink}>
                <LinkIcon size={14} /> Show invite link
              </button>
            )}
          </div>

          <div className="group-panel-settings">
            <label className="group-panel-toggle">
              <input type="checkbox" checked={infoAdminOnly} onChange={toggleInfoAdminOnly} />
              Only admins can edit group info
            </label>
            <label className="group-panel-toggle">
              <input type="checkbox" checked={messagesAdminOnly} onChange={toggleMessagesAdminOnly} />
              Only admins can send messages
            </label>
          </div>

          <div className="group-panel-field">
            <div className="group-panel-field-label">
              {participants.length} participant{participants.length === 1 ? "" : "s"}
            </div>
            <button type="button" className="group-panel-link-btn" onClick={() => setPickerOpen(true)}>
              <PlusIcon size={14} /> Add participants
            </button>
            {loading && <div className="group-panel-empty">Loading…</div>}
            <ul className="group-panel-participants">
              {participants.map((p) => (
                <li key={p.id} className="group-panel-participant">
                  <Avatar initials={initials(shortId(p.id))} color="#dcd3c4" size={32} />
                  <span className="group-panel-participant-id">{shortId(p.pn ?? p.id)}</span>
                  {(p.role === "admin" || p.role === "superadmin") && (
                    <span className="group-panel-role-badge" title={p.role}>
                      <ShieldIcon size={12} /> {p.role === "superadmin" ? "Owner" : "Admin"}
                    </span>
                  )}
                  <div className="group-panel-participant-actions">
                    {p.role === "participant" ? (
                      <button type="button" onClick={() => handlePromote(p.id)} title="Promote to admin">
                        <ShieldIcon size={14} />
                      </button>
                    ) : p.role === "admin" ? (
                      <button type="button" onClick={() => handleDemote(p.id)} title="Demote to member">
                        <ShieldIcon size={14} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.id)}
                      title="Remove from group"
                      className="group-panel-remove-btn"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="group-panel-danger">
            <button type="button" onClick={handleLeave}>
              <LogOutIcon size={15} /> Leave group
            </button>
            <button type="button" className="group-panel-menu-danger" onClick={handleDelete}>
              <TrashIcon size={15} /> Delete group
            </button>
          </div>
        </div>

        {pickerOpen && (
          <ContactPicker
            title="Add participants"
            onSelectMultiple={handleAddParticipants}
            onClose={() => setPickerOpen(false)}
            excludeIds={participants.map((p) => p.id)}
          />
        )}
      </div>
    </div>
  );
}
