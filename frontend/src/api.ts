import { demoApi } from "./demo-data.js";

export type MessageStatus = "sent" | "delivered" | "read";
export type MessageType =
  | "text"
  | "image"
  | "file"
  | "voice"
  | "video"
  | "location"
  | "contact"
  | "poll"
  | "buttons"
  | "list";

export interface MessageButton {
  id: string;
  text: string;
}

export interface ListRow {
  rowId: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

/** One option in a poll message, with the voter ids (JIDs) that picked it — mirrors what a
 *  `sendPollVote` roundtrip would let us reconstruct locally (WAHA gives us the vote events,
 *  not a server-computed tally, so counting is a client concern). */
export interface PollOption {
  name: string;
  votes: string[];
}

export interface Chat {
  id: string;
  name: string;
  avatarInitials: string;
  avatarColor: string;
  isGroup?: boolean;
  participantsCount?: number;
  presence?: string;
  pinned?: boolean;
  isArchived?: boolean;
  isBlocked?: boolean;
  unreadCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: number;
  lastMessageFromMe?: boolean;
  lastMessageStatus?: MessageStatus;
  [key: string]: unknown;
}

export interface NumberStatus {
  numberExists: boolean;
  chatId: string | null;
}

/** A highlighted span *inside a `SearchHit.snippet`* — the backend computes these so the
 *  frontend never has to re-implement the (accent-folding) matcher to underline a word. */
export interface Highlight {
  start: number;
  length: number;
}

export interface SearchHit {
  chatId: string;
  chatName: string;
  messageId: string;
  timestamp: number;
  fromMe: boolean;
  snippet: string;
  highlights: Highlight[];
}

/** `stats.partial` is the honest bit: the backend indexes a bounded slice of history (see
 *  backend/src/search/message-index.ts), so the UI says "searched the last N chats" rather
 *  than implying the whole archive was covered. */
export interface SearchStats {
  chats: number;
  messages: number;
  builtAt: number;
  buildMs: number;
  partial: boolean;
  skippedChats: number;
  searchMs: number;
  matches: number;
  building: boolean;
}

export interface SearchResponse {
  query: string;
  terms: string[];
  results: SearchHit[];
  stats: SearchStats;
}

export interface Message {
  id: string;
  timestamp: number;
  fromMe: boolean;
  senderName?: string;
  type: MessageType;
  body: string;
  mediaName?: string;
  mediaUrl?: string;
  durationSec?: number;
  status?: MessageStatus;
  reaction?: string;
  starred?: boolean;
  pinned?: boolean;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  contactName?: string;
  contactNumber?: string;
  pollName?: string;
  pollOptions?: PollOption[];
  pollMultipleAnswers?: boolean;
  footer?: string;
  buttons?: MessageButton[];
  listButtonText?: string;
  listSections?: ListSection[];
  [key: string]: unknown;
}

export interface Label {
  id: string;
  name: string;
  color: number;
  colorHex: string;
}

export interface PeerPresence {
  participant: string;
  lastKnownPresence: string;
  lastSeen: number | null;
}

export interface ChatPresence {
  id: string;
  presences: PeerPresence[];
}

/** WhatsApp only supports these three pin lifetimes — mirrors the backend's `PIN_DURATIONS`. */
export const PIN_DURATIONS = {
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
} as const;

/** WhatsApp allows 2-12 poll options — mirrors the backend's `POLL_MIN_OPTIONS`/`POLL_MAX_OPTIONS`. */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 12;

/** WhatsApp Business limits quick-reply buttons to 3 per message — mirrors the backend's
 *  `BUTTONS_MAX`. */
export const BUTTONS_MAX = 3;

/** Either a remote URL or inline base64 data, both tagged with a mimetype — mirrors WAHA's
 *  `MessageImageRequest.file` shape (see backend `WahaFileInput`). */
export type OutgoingFile =
  | { mimetype: string; filename?: string; url: string }
  | { mimetype: string; filename?: string; data: string };

export interface SendError {
  error: string;
  reason?: string;
}

/** `truncated: true` means we hit the fetch cap (`limit`) — older messages likely exist but
 *  weren't loaded via this session. `truncated: false` means WAHA returned fewer than `limit`,
 *  which is the best signal available (WAHA's API has no total-count field) but still isn't a
 *  guarantee this matches the complete history on the phone. */
export interface MessagesResult {
  messages: Message[];
  limit: number;
  offset: number;
  truncated: boolean;
}

export interface Contact {
  id: string;
  name?: string;
  pushname?: string;
  number?: string;
  isMyContact?: boolean;
}

export interface ContactAbout {
  about: string | null;
}

export interface Group {
  id: string;
  subject?: string;
  [key: string]: unknown;
}

export type GroupParticipantRole = "left" | "participant" | "admin" | "superadmin";

export interface GroupParticipant {
  id: string;
  pn?: string;
  role: GroupParticipantRole;
}

export interface GroupJoinInfo {
  id?: string;
  subject?: string;
  [key: string]: unknown;
}

export interface Profile {
  id: string;
  picture: string | null;
  name: string;
}

/** Mirrors the backend's `sendGuardStatus()` (`GET /api/guard/status`) — read-only introspection
 *  into the anti-detection guard so the client can show "is it safe to send right now" without
 *  a human grepping logs. */
export interface GuardStatus {
  warmingUp: boolean;
  warmupEndsAt: number;
  circuitBreaker: {
    open: boolean;
    openUntil: number | null;
    recentFailures: number;
  };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    let parsed: SendError | undefined;
    try {
      parsed = JSON.parse(body);
    } catch {
      // not JSON — fall through to a generic error below
    }
    const err = new Error(parsed?.reason ?? parsed?.error ?? `${res.status} ${body}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

/** Demo mode is the default: it never calls a backend or a real WAHA/WhatsApp session.
 *  Set VITE_DEMO_MODE=false (self-hosted, real WAHA instance) to use the real API. */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

const realApi = {
  listChats: () => fetch("/api/chats").then((r) => json<Chat[]>(r)),

  /** `offset` walks further back into history a page at a time — "load older messages" passes
   *  the count already loaded so far. */
  getMessages: (chatId: string, offset = 0) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages${offset ? `?offset=${offset}` : ""}`,
    ).then((r) => json<MessagesResult>(r)),

  sendMessage: (chatId: string, text: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => json<Message>(r)),

  sendImage: (chatId: string, file: OutgoingFile, caption?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, caption }),
    }).then((r) => json<Message>(r)),

  setReaction: (chatId: string, messageId: string, reaction: string) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reaction`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      },
    ).then((r) => json<void>(r)),

  setStar: (chatId: string, messageId: string, star: boolean) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/star`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ star }),
      },
    ).then((r) => json<void>(r)),

  getChatPicture: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/picture`).then((r) =>
      json<{ url: string | null }>(r),
    ),

  sendFile: (chatId: string, file: OutgoingFile, caption?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, caption }),
    }).then((r) => json<Message>(r)),

  sendVideo: (chatId: string, file: OutgoingFile, caption?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, caption }),
    }).then((r) => json<Message>(r)),

  sendVoice: (chatId: string, file: OutgoingFile) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    }).then((r) => json<Message>(r)),

  sendPoll: (chatId: string, name: string, options: string[], multipleAnswers?: boolean) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, options, multipleAnswers }),
    }).then((r) => json<Message>(r)),

  votePoll: (chatId: string, messageId: string, votes: string[]) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/poll-vote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votes }),
      },
    ).then((r) => json<{ ok: true }>(r)),

  sendLocation: (chatId: string, latitude: number, longitude: number, name?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude, title: name }),
    }).then((r) => json<Message>(r)),

  sendContact: (chatId: string, contactId: string, name?: string, phoneNumber?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, name, phoneNumber }),
    }).then((r) => json<Message>(r)),

  markRead: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/read`, { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  markUnread: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/unread`, { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  getPresence: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/presence`).then((r) =>
      json<ChatPresence>(r),
    ),

  subscribePresence: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/presence/subscribe`, {
      method: "POST",
    }).then((r) => json<{ ok: true }>(r)),

  pinMessage: (chatId: string, messageId: string, duration: number) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/pin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration }),
      },
    ).then((r) => json<{ ok: true }>(r)),

  unpinMessage: (chatId: string, messageId: string) =>
    fetch(
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/unpin`,
      { method: "POST" },
    ).then((r) => json<{ ok: true }>(r)),

  archiveChat: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/archive`, { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  unarchiveChat: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/unarchive`, { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  deleteChat: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}`, { method: "DELETE" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  clearChatMessages: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, { method: "DELETE" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  deleteMessage: (chatId: string, messageId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    }).then((r) => json<{ ok: true }>(r)),

  editMessage: (chatId: string, messageId: string, text: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => json<{ ok: true }>(r)),

  sendButtons: (chatId: string, body: string, buttons: MessageButton[], footer?: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/buttons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, buttons, footer }),
    }).then((r) => json<Message>(r)),

  sendList: (
    chatId: string,
    body: string,
    buttonText: string,
    sections: ListSection[],
    footer?: string,
  ) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, buttonText, sections, footer }),
    }).then((r) => json<Message>(r)),

  checkNumberExists: (phone: string) =>
    fetch(`/api/contacts/check-exists?phone=${encodeURIComponent(phone)}`).then((r) =>
      json<NumberStatus>(r),
    ),

  listContacts: () => fetch("/api/contacts").then((r) => json<Contact[]>(r)),

  /** Backs `ContactDetailPanel` — single-contact lookup (name/number/isMyContact), the missing
   *  UI slot `GET contacts/{id}` had no caller for since it was wired backend-side. */
  getContact: (contactId: string) =>
    fetch(`/api/contacts/${encodeURIComponent(contactId)}`).then((r) => json<Contact>(r)),

  getContactAbout: (contactId: string) =>
    fetch(`/api/contacts/about?contactId=${encodeURIComponent(contactId)}`).then((r) =>
      json<ContactAbout>(r),
    ),

  blockContact: (contactId: string) =>
    fetch("/api/contacts/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    }).then((r) => json<{ ok: true }>(r)),

  unblockContact: (contactId: string) =>
    fetch("/api/contacts/unblock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    }).then((r) => json<{ ok: true }>(r)),

  runAiCommand: (chatId: string, instruction: string) =>
    fetch("/api/ai/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, instruction }),
    }).then((r) => json<{ suggestion: string }>(r)),

  listLabels: () => fetch("/api/labels").then((r) => json<Label[]>(r)),

  createLabel: (name: string) =>
    fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<Label>(r)),

  updateLabel: (labelId: string, name: string, color?: number, colorHex?: string) =>
    fetch(`/api/labels/${encodeURIComponent(labelId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color, colorHex }),
    }).then((r) => json<Label>(r)),

  deleteLabel: (labelId: string) =>
    fetch(`/api/labels/${encodeURIComponent(labelId)}`, { method: "DELETE" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  getChatLabels: (chatId: string) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/labels`).then((r) => json<Label[]>(r)),

  setChatLabels: (chatId: string, labelIds: string[]) =>
    fetch(`/api/chats/${encodeURIComponent(chatId)}/labels`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelIds }),
    }).then((r) => json<{ ok: true }>(r)),

  /** Backs the chat list's "filter by label" view — just the ids, matched against the chats
   *  already held in state rather than trusting WAHA's own (unenriched) chat shape here. */
  getChatsByLabel: (labelId: string) =>
    fetch(`/api/labels/${encodeURIComponent(labelId)}/chats`).then((r) =>
      json<{ id: string }[]>(r),
    ),

  // --- Groups ------------------------------------------------------------------------------

  listGroups: () => fetch("/api/groups").then((r) => json<Group[]>(r)),

  createGroup: (name: string, participantIds: string[]) =>
    fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, participantIds }),
    }).then((r) => json<Group>(r)),

  getGroupJoinInfo: (code: string) =>
    fetch(`/api/groups/join-info?code=${encodeURIComponent(code)}`).then((r) =>
      json<GroupJoinInfo>(r),
    ),

  joinGroup: (code: string) =>
    fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).then((r) => json<{ id: string }>(r)),

  getGroup: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}`).then((r) => json<Group>(r)),

  deleteGroup: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  leaveGroup: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/leave`, { method: "POST" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  getGroupPicture: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/picture`).then((r) =>
      json<{ url: string | null }>(r),
    ),

  setGroupPicture: (groupId: string, file: OutgoingFile) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/picture`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    }).then((r) => json<{ success: boolean }>(r)),

  deleteGroupPicture: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/picture`, { method: "DELETE" }).then((r) =>
      json<{ ok: true }>(r),
    ),

  setGroupSubject: (groupId: string, subject: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/subject`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    }).then((r) => json<{ ok: true }>(r)),

  setGroupDescription: (groupId: string, description: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/description`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    }).then((r) => json<{ ok: true }>(r)),

  getGroupInfoAdminOnly: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/settings/info-admin-only`).then((r) =>
      json<{ adminsOnly: boolean }>(r),
    ),

  setGroupInfoAdminOnly: (groupId: string, adminsOnly: boolean) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/settings/info-admin-only`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminsOnly }),
    }).then((r) => json<{ ok: true }>(r)),

  getGroupMessagesAdminOnly: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/settings/messages-admin-only`).then((r) =>
      json<{ adminsOnly: boolean }>(r),
    ),

  setGroupMessagesAdminOnly: (groupId: string, adminsOnly: boolean) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/settings/messages-admin-only`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminsOnly }),
    }).then((r) => json<{ ok: true }>(r)),

  getGroupInviteCode: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/invite-code`).then((r) => json<string>(r)),

  revokeGroupInviteCode: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/invite-code/revoke`, {
      method: "POST",
    }).then((r) => json<string>(r)),

  getGroupParticipants: (groupId: string) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/participants`).then((r) =>
      json<GroupParticipant[]>(r),
    ),

  addGroupParticipants: (groupId: string, participantIds: string[]) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/participants/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds }),
    }).then((r) => json<{ ok: true }>(r)),

  removeGroupParticipants: (groupId: string, participantIds: string[]) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/participants/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds }),
    }).then((r) => json<{ ok: true }>(r)),

  promoteGroupParticipants: (groupId: string, participantIds: string[]) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/admin/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds }),
    }).then((r) => json<{ ok: true }>(r)),

  demoteGroupParticipants: (groupId: string, participantIds: string[]) =>
    fetch(`/api/groups/${encodeURIComponent(groupId)}/admin/demote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds }),
    }).then((r) => json<{ ok: true }>(r)),

  // --- Profile (own account) ----------------------------------------------------------------

  getProfile: () => fetch("/api/profile").then((r) => json<Profile>(r)),

  setProfileName: (name: string) =>
    fetch("/api/profile/name", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<{ success: boolean }>(r)),

  setProfileStatus: (status: string) =>
    fetch("/api/profile/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => json<{ success: boolean }>(r)),

  setProfilePicture: (file: OutgoingFile) =>
    fetch("/api/profile/picture", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    }).then((r) => json<{ success: boolean }>(r)),

  deleteProfilePicture: () =>
    fetch("/api/profile/picture", { method: "DELETE" }).then((r) => json<{ success: boolean }>(r)),

  // --- Guard (anti-detection) ---------------------------------------------------------------

  getGuardStatus: () => fetch("/api/guard/status").then((r) => json<GuardStatus>(r)),

  // --- Search ------------------------------------------------------------------------------

  searchMessages: (query: string, opts: { chatId?: string; limit?: number } = {}) => {
    const params = new URLSearchParams({ q: query });
    if (opts.chatId) params.set("chatId", opts.chatId);
    if (opts.limit) params.set("limit", String(opts.limit));
    return fetch(`/api/search?${params}`).then((r) => json<SearchResponse>(r));
  },
};

export const api = DEMO_MODE ? demoApi : realApi;
