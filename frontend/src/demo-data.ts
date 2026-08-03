import type {
  Chat,
  ChatPresence,
  Contact,
  Group,
  GroupJoinInfo,
  GroupParticipant,
  GuardStatus,
  Label,
  ListSection,
  Message,
  MessageButton,
  MessagesResult,
  MessageStatus,
  MessageType,
  NumberStatus,
  OutgoingFile,
  Profile,
  SearchHit,
} from "./api.js";
import { messagePreview } from "./format.js";

const NOW = Math.floor(Date.now() / 1000);
const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function ago(seconds: number): number {
  return NOW - seconds;
}

interface RawMessage {
  timestamp: number;
  fromMe: boolean;
  type: MessageType;
  body: string;
  senderName?: string;
  status?: MessageStatus;
  mediaName?: string;
  durationSec?: number;
}

const RAW_MESSAGES: Record<string, RawMessage[]> = {
  "demo-1": [
    { timestamp: ago(2 * DAY), fromMe: false, type: "text", body: "Hey! Are we still on for Friday?" },
    { timestamp: ago(2 * DAY - 60), fromMe: true, type: "text", body: "Yep, 7pm works for me.", status: "read" },
    { timestamp: ago(2 * DAY - 90), fromMe: false, type: "text", body: "Perfect, see you then 🙂" },
    { timestamp: ago(5 * MIN), fromMe: false, type: "text", body: "Also — could you send the address again?" },
    { timestamp: ago(2 * MIN), fromMe: false, type: "text", body: "No rush, whenever you get a sec" },
  ],
  "demo-2": [
    { timestamp: ago(HOUR), fromMe: false, type: "text", body: "Found a place for the trip, sending the link" },
    { timestamp: ago(HOUR - 30), fromMe: false, type: "image", body: "Rooftop with a view, 4 beds" },
    { timestamp: ago(20 * MIN), fromMe: false, type: "text", body: "https://example.com/listing/123" },
    { timestamp: ago(3 * MIN), fromMe: false, type: "text", body: "Let me know what you think!" },
  ],
  "demo-3": [
    { timestamp: ago(DAY), fromMe: false, senderName: "Priya", type: "text", body: "Who's in for lunch tomorrow?" },
    { timestamp: ago(DAY - 60), fromMe: false, senderName: "Marco", type: "text", body: "I'm in!" },
    { timestamp: ago(DAY - 90), fromMe: true, type: "text", body: "Count me in too", status: "read" },
    { timestamp: ago(40 * MIN), fromMe: false, senderName: "Priya", type: "file", body: "", mediaName: "menu-ramen-place.pdf" },
    { timestamp: ago(35 * MIN), fromMe: false, senderName: "Marco", type: "text", body: "That place looks great, 12:30?" },
  ],
  "demo-4": [
    { timestamp: ago(3 * DAY), fromMe: true, type: "text", body: "Here's the photo from the hike", status: "read" },
    { timestamp: ago(3 * DAY - 20), fromMe: true, type: "image", body: "Summit view, worth the climb", status: "read" },
    { timestamp: ago(6 * HOUR), fromMe: false, type: "text", body: "That view is incredible, where was this?" },
    { timestamp: ago(15 * MIN), fromMe: true, type: "text", body: "Sending you the trail map now", status: "delivered" },
  ],
  "demo-5": [
    { timestamp: ago(5 * DAY), fromMe: false, senderName: "Noor", type: "text", body: "Starting the next book Monday — 'Piranesi'" },
    { timestamp: ago(12 * HOUR), fromMe: false, senderName: "Tariq", type: "voice", body: "", durationSec: 34 },
    { timestamp: ago(2 * HOUR), fromMe: true, type: "text", body: "Just finished chapter 3, no spoilers please 😅", status: "sent" },
  ],
};

/** Length-preserving fold (one folded character per original character), so a match offset in
 *  the folded string is also a valid offset in the original — the backend's matcher keeps an
 *  explicit index map instead, which is more correct but more machinery than a mock needs. */
function demoFold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const folded = ch.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    out += folded[0] ?? ch;
  }
  return out;
}

export const DEMO_MESSAGES: Record<string, Message[]> = {};
for (const [chatId, msgs] of Object.entries(RAW_MESSAGES)) {
  DEMO_MESSAGES[chatId] = msgs.map((m, i) => ({ id: `${chatId}-m${i}`, ...m }));
}

function lastMessageFields(chatId: string) {
  const msgs = DEMO_MESSAGES[chatId];
  const last = msgs[msgs.length - 1];
  return {
    lastMessagePreview: messagePreview(last),
    lastMessageAt: last.timestamp,
    lastMessageFromMe: last.fromMe,
    lastMessageStatus: last.status,
  };
}

/** Canned chats for the public demo deployment — no real WhatsApp connection involved. */
export const DEMO_CHATS: Chat[] = [
  {
    id: "demo-2",
    name: "Sam — trip planning",
    avatarInitials: "S",
    avatarColor: "#f6a06b",
    pinned: true,
    unreadCount: 3,
    presence: "online",
    ...lastMessageFields("demo-2"),
  },
  {
    id: "demo-1",
    name: "Alex",
    avatarInitials: "A",
    avatarColor: "#aebf92",
    unreadCount: 2,
    presence: "online",
    ...lastMessageFields("demo-1"),
  },
  {
    id: "demo-3",
    name: "Team lunch 🍜",
    avatarInitials: "TL",
    avatarColor: "#dcd3c4",
    isGroup: true,
    participantsCount: 5,
    presence: "Priya, Marco, +3 others",
    ...lastMessageFields("demo-3"),
  },
  {
    id: "demo-4",
    name: "Jordan",
    avatarInitials: "J",
    avatarColor: "#ccdbb2",
    presence: "last seen today at 09:14",
    ...lastMessageFields("demo-4"),
  },
  {
    id: "demo-5",
    name: "Book club 📚",
    avatarInitials: "BC",
    avatarColor: "#ffe1d0",
    isGroup: true,
    participantsCount: 8,
    presence: "Noor, Tariq, +6 others",
    ...lastMessageFields("demo-5"),
  },
];

/** Canned contact list for the picker (new chat / share contact) — mixes contacts that already
 *  have a chat (so picking them jumps straight there, `id` matches the `DEMO_CHATS` entry) with
 *  a couple that don't yet (so picking them demonstrates starting a fresh chat). */
export const DEMO_CONTACTS: Contact[] = [
  { id: "demo-2", name: "Sam", pushname: "Sam", number: "+1 415 555 0142" },
  { id: "demo-1", name: "Alex", pushname: "Alex", number: "+1 415 555 0198" },
  { id: "demo-4", name: "Jordan", pushname: "Jordan", number: "+1 415 555 0110" },
  { id: "15551230001@c.us", name: "Priya", pushname: "Priya", number: "+1 555 123 0001" },
  { id: "15551230002@c.us", name: "Marco", pushname: "Marco", number: "+1 555 123 0002" },
  { id: "15551230003@c.us", name: "Noor", pushname: "Noor", number: "+1 555 123 0003" },
  { id: "15551230004@c.us", name: "Tariq", pushname: "Tariq", number: "+1 555 123 0004" },
  { id: "15551230005@c.us", name: "Priya's studio", number: "+1 555 123 0005" },
];

/** A couple of canned "about" texts (WhatsApp's status line) so the demo's contact-detail panel
 *  has something real to show — most contacts have none, an honest reflection of most real
 *  WhatsApp accounts too (see the panel's "No about info shared" fallback). */
const DEMO_CONTACT_ABOUT: Record<string, string> = {
  "demo-2": "Busy building things ⚡",
  "demo-1": "Available",
};

let nextLabelId = 3;
export const DEMO_LABELS: Label[] = [
  { id: "1", name: "Friends", color: 0, colorHex: "#ff9485" },
  { id: "2", name: "Trip planning", color: 1, colorHex: "#54c9c2" },
];

const DEMO_CHAT_LABELS: Record<string, string[]> = {
  "demo-2": ["2"],
};

/** The demo's own identity — stands in for "me" across group participant lists and the
 *  Settings screen. Mutable (name/status are editable in the demo, same as the real profile
 *  routes) but not persisted across a page reload, same as the rest of the demo state. */
const DEMO_PROFILE: Profile = {
  id: "15550001000@c.us",
  picture: null,
  name: "You",
};

const DEMO_GROUP_PARTICIPANTS: Record<string, GroupParticipant[]> = {
  "demo-3": [
    { id: "15551230001@c.us", pn: "15551230001@c.us", role: "superadmin" }, // Priya
    { id: "15551230002@c.us", pn: "15551230002@c.us", role: "admin" }, // Marco
    { id: DEMO_PROFILE.id, pn: DEMO_PROFILE.id, role: "participant" },
    { id: "15551239001@c.us", pn: "15551239001@c.us", role: "participant" },
    { id: "15551239002@c.us", pn: "15551239002@c.us", role: "participant" },
  ],
  "demo-5": [
    { id: "15551230003@c.us", pn: "15551230003@c.us", role: "admin" }, // Noor
    { id: "15551230004@c.us", pn: "15551230004@c.us", role: "participant" }, // Tariq
    { id: DEMO_PROFILE.id, pn: DEMO_PROFILE.id, role: "participant" },
    { id: "15551239003@c.us", pn: "15551239003@c.us", role: "participant" },
    { id: "15551239004@c.us", pn: "15551239004@c.us", role: "participant" },
    { id: "15551239005@c.us", pn: "15551239005@c.us", role: "participant" },
    { id: "15551239006@c.us", pn: "15551239006@c.us", role: "participant" },
    { id: "15551239007@c.us", pn: "15551239007@c.us", role: "participant" },
  ],
};

const DEMO_GROUP_DESCRIPTIONS: Record<string, string> = {
  "demo-3": "Where do we eat this week? 🍜",
  "demo-5": "One book a month, no spoilers before chapter 3.",
};

const DEMO_GROUP_SETTINGS: Record<string, { infoAdminOnly: boolean; messagesAdminOnly: boolean }> = {};

const DEMO_GROUP_INVITE_CODES: Record<string, string> = {};

function demoInviteCode(): string {
  return Math.random().toString(36).slice(2, 10);
}

const CANNED_SUGGESTIONS: { match: RegExp; suggestion: string }[] = [
  {
    match: /summar/i,
    suggestion:
      "(Demo suggestion) Quick summary: plans are confirmed, no open questions — just a friendly back-and-forth.",
  },
  {
    match: /draft|repl(y|ies)/i,
    suggestion: "(Demo suggestion) Sounds good, thanks for sorting that out! Talk soon.",
  },
];

/** Simulates the backend's claude -p call with a canned reply — this deployment has no
 *  backend/claude CLI behind it, so real AI command execution only runs when self-hosted. */
export function demoAiCommand(instruction: string): string {
  const hit = CANNED_SUGGESTIONS.find((c) => c.match.test(instruction));
  return hit?.suggestion ?? `(Demo suggestion) Here's a draft reply for: "${instruction}"`;
}

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const demoApi = {
  listChats: () =>
    delay([...DEMO_CHATS].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))),

  // All canned threads are well under any real fetch cap, so `truncated` is always false — an
  // honest reflection of demo data, not a hardcoded claim about real WAHA history. `offset`
  // walks backwards from the end of the canned array (mirrors the real "load older" page
  // shape) — once it runs past the start there's nothing left to load, same as a real chat
  // that's fully paged through.
  getMessages: (chatId: string, offset = 0): Promise<MessagesResult> => {
    const all = DEMO_MESSAGES[chatId] ?? [];
    const end = Math.max(all.length - offset, 0);
    const start = Math.max(end - 100, 0);
    return delay({ messages: all.slice(start, end), limit: 100, offset, truncated: false });
  },

  sendMessage: (chatId: string, text: string) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "text",
      body: text,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = messagePreview(message);
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  sendImage: (chatId: string, file: OutgoingFile, caption?: string) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "image",
      body: caption ?? "",
      mediaUrl: "url" in file ? file.url : `data:${file.mimetype};base64,${file.data}`,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = messagePreview(message);
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  setReaction: (chatId: string, messageId: string, reaction: string) => {
    const message = (DEMO_MESSAGES[chatId] ?? []).find((m) => m.id === messageId);
    if (message) message.reaction = reaction || undefined;
    return delay(undefined);
  },

  setStar: (chatId: string, messageId: string, star: boolean) => {
    const message = (DEMO_MESSAGES[chatId] ?? []).find((m) => m.id === messageId);
    if (message) message.starred = star;
    return delay(undefined);
  },

  sendFile: (chatId: string, file: OutgoingFile, caption?: string) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "file",
      body: caption ?? "",
      mediaName: file.filename ?? "File",
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = messagePreview(message);
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  sendVideo: (chatId: string, file: OutgoingFile, caption?: string) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "video",
      body: caption ?? "",
      mediaUrl: "url" in file ? file.url : `data:${file.mimetype};base64,${file.data}`,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = messagePreview(message);
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  sendVoice: (chatId: string, file: OutgoingFile) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "voice",
      body: "",
      mediaUrl: "url" in file ? file.url : `data:${file.mimetype};base64,${file.data}`,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = "🎤 Voice message";
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  sendPoll: (chatId: string, name: string, options: string[], multipleAnswers?: boolean) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "poll",
      body: name,
      pollName: name,
      pollOptions: options.map((o) => ({ name: o, votes: [] })),
      pollMultipleAnswers: multipleAnswers ?? false,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = `📊 ${name}`;
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  // "Me" is a fixed synthetic voter id in the demo (there's no real WAHA session to derive one
  // from) — same role `DEMO_PROFILE.id` plays for group participant lists.
  votePoll: (chatId: string, messageId: string, votes: string[]) => {
    const message = (DEMO_MESSAGES[chatId] ?? []).find((m) => m.id === messageId);
    if (message?.pollOptions) {
      const voterId = DEMO_PROFILE.id;
      for (const opt of message.pollOptions) {
        opt.votes = opt.votes.filter((v) => v !== voterId);
        if (votes.includes(opt.name)) opt.votes.push(voterId);
      }
    }
    return delay({ ok: true as const });
  },

  sendLocation: (chatId: string, latitude: number, longitude: number, name?: string) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "location",
      body: name ?? "Shared location",
      latitude,
      longitude,
      locationName: name,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = "📍 Location";
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  sendContact: (chatId: string, contactId: string, name?: string, phoneNumber?: string) => {
    const contact = DEMO_CONTACTS.find((c) => c.id === contactId);
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "contact",
      body: "",
      contactName: name ?? contact?.name ?? contact?.pushname ?? "Contact",
      contactNumber: phoneNumber ?? contact?.number,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = `👤 ${message.contactName}`;
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  markRead: (chatId: string) => {
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) chat.unreadCount = 0;
    return delay({ ok: true as const });
  },

  markUnread: (chatId: string) => {
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) chat.unreadCount = Math.max(1, chat.unreadCount ?? 0);
    return delay({ ok: true as const });
  },

  // The demo has no live WAHA presence stream — derive a plausible one from the canned
  // "online" / "last seen ..." text already shown in the chat list, so ChatHeader's real-mode
  // presence code path renders something sensible here too instead of a hardcoded stub.
  getPresence: (chatId: string) => {
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    const online = chat?.presence === "online";
    const presence: ChatPresence = {
      id: chatId,
      presences: [
        {
          participant: chatId,
          lastKnownPresence: online ? "online" : "offline",
          lastSeen: online ? null : ago(3 * HOUR),
        },
      ],
    };
    return delay(presence);
  },

  subscribePresence: (_chatId: string) => delay({ ok: true as const }),

  pinMessage: (chatId: string, messageId: string, _duration: number) => {
    const message = (DEMO_MESSAGES[chatId] ?? []).find((m) => m.id === messageId);
    if (message) message.pinned = true;
    return delay({ ok: true as const });
  },

  unpinMessage: (chatId: string, messageId: string) => {
    const message = (DEMO_MESSAGES[chatId] ?? []).find((m) => m.id === messageId);
    if (message) message.pinned = false;
    return delay({ ok: true as const });
  },

  // The public demo never has a real profile picture — always fall back to the initials avatar.
  getChatPicture: (_chatId: string) => delay({ url: null }),

  archiveChat: (chatId: string) => {
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) chat.isArchived = true;
    return delay({ ok: true as const });
  },

  unarchiveChat: (chatId: string) => {
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) chat.isArchived = false;
    return delay({ ok: true as const });
  },

  deleteChat: (chatId: string) => {
    const idx = DEMO_CHATS.findIndex((c) => c.id === chatId);
    if (idx !== -1) DEMO_CHATS.splice(idx, 1);
    delete DEMO_MESSAGES[chatId];
    return delay({ ok: true as const });
  },

  clearChatMessages: (chatId: string) => {
    DEMO_MESSAGES[chatId] = [];
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = undefined;
      chat.lastMessageAt = undefined;
      chat.lastMessageFromMe = undefined;
      chat.lastMessageStatus = undefined;
    }
    return delay({ ok: true as const });
  },

  deleteMessage: (chatId: string, messageId: string) => {
    const msgs = DEMO_MESSAGES[chatId];
    if (msgs) DEMO_MESSAGES[chatId] = msgs.filter((m) => m.id !== messageId);
    return delay({ ok: true as const });
  },

  editMessage: (chatId: string, messageId: string, text: string) => {
    const message = (DEMO_MESSAGES[chatId] ?? []).find((m) => m.id === messageId);
    if (message) message.body = text;
    return delay({ ok: true as const });
  },

  sendButtons: (chatId: string, body: string, buttons: MessageButton[], footer?: string) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "buttons",
      body,
      footer,
      buttons,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = body;
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  sendList: (
    chatId: string,
    body: string,
    buttonText: string,
    sections: ListSection[],
    footer?: string,
  ) => {
    const message: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      type: "list",
      body,
      footer,
      listButtonText: buttonText,
      listSections: sections,
      status: "sent",
    };
    (DEMO_MESSAGES[chatId] ??= []).push(message);
    const chat = DEMO_CHATS.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessagePreview = body;
      chat.lastMessageAt = message.timestamp;
      chat.lastMessageFromMe = true;
      chat.lastMessageStatus = "sent";
      chat.unreadCount = 0;
    }
    return delay(message);
  },

  // No real WAHA behind the demo — treat any string with at least 8 digits as "on WhatsApp",
  // same shape (`numberExists` + `chatId`) the real endpoint returns.
  checkNumberExists: (phone: string): Promise<NumberStatus> => {
    const digits = phone.replace(/\D/g, "");
    const exists = digits.length >= 8;
    return delay({ numberExists: exists, chatId: exists ? `${digits}@c.us` : null });
  },

  runAiCommand: (_chatId: string, instruction: string) =>
    delay({ suggestion: demoAiCommand(instruction) }, 500),

  listContacts: () => delay([...DEMO_CONTACTS]),

  getContact: (contactId: string) => {
    const contact = DEMO_CONTACTS.find((c) => c.id === contactId);
    return delay(contact ? { ...contact, isMyContact: true } : { id: contactId, isMyContact: false });
  },

  getContactAbout: (contactId: string) => delay({ about: DEMO_CONTACT_ABOUT[contactId] ?? null }),

  blockContact: (contactId: string) => {
    const chat = DEMO_CHATS.find((c) => c.id === contactId);
    if (chat) chat.isBlocked = true;
    return delay({ ok: true as const });
  },

  unblockContact: (contactId: string) => {
    const chat = DEMO_CHATS.find((c) => c.id === contactId);
    if (chat) chat.isBlocked = false;
    return delay({ ok: true as const });
  },

  listLabels: () => delay([...DEMO_LABELS]),

  createLabel: (name: string) => {
    const label: Label = { id: String(nextLabelId++), name, color: 0, colorHex: "#8696a0" };
    DEMO_LABELS.push(label);
    return delay(label);
  },

  updateLabel: (labelId: string, name: string, color?: number, colorHex?: string) => {
    const label = DEMO_LABELS.find((l) => l.id === labelId);
    if (!label) throw new Error("Label not found");
    label.name = name;
    if (color !== undefined) label.color = color;
    if (colorHex !== undefined) label.colorHex = colorHex;
    return delay({ ...label });
  },

  deleteLabel: (labelId: string) => {
    const idx = DEMO_LABELS.findIndex((l) => l.id === labelId);
    if (idx !== -1) DEMO_LABELS.splice(idx, 1);
    for (const chatId of Object.keys(DEMO_CHAT_LABELS)) {
      DEMO_CHAT_LABELS[chatId] = DEMO_CHAT_LABELS[chatId].filter((id) => id !== labelId);
    }
    return delay({ ok: true as const });
  },

  getChatLabels: (chatId: string) => {
    const ids = DEMO_CHAT_LABELS[chatId] ?? [];
    return delay(DEMO_LABELS.filter((l) => ids.includes(l.id)));
  },

  setChatLabels: (chatId: string, labelIds: string[]) => {
    DEMO_CHAT_LABELS[chatId] = [...labelIds];
    return delay({ ok: true as const });
  },

  getChatsByLabel: (labelId: string) => {
    const ids = Object.entries(DEMO_CHAT_LABELS)
      .filter(([, labelIds]) => labelIds.includes(labelId))
      .map(([chatId]) => chatId);
    return delay(ids.map((id) => ({ id })));
  },

  // --- Groups ------------------------------------------------------------------------------

  listGroups: (): Promise<Group[]> =>
    delay(DEMO_CHATS.filter((c) => c.isGroup).map((c) => ({ id: c.id, subject: c.name }))),

  createGroup: (name: string, participantIds: string[]): Promise<Group> => {
    const id = `demo-group-${Date.now()}`;
    const chat: Chat = {
      id,
      name,
      avatarInitials: name.trim().slice(0, 2).toUpperCase() || "G",
      avatarColor: "#aebf92",
      isGroup: true,
      participantsCount: participantIds.length + 1,
    };
    DEMO_CHATS.unshift(chat);
    DEMO_MESSAGES[id] = [];
    DEMO_GROUP_PARTICIPANTS[id] = [
      { id: DEMO_PROFILE.id, pn: DEMO_PROFILE.id, role: "superadmin" },
      ...participantIds.map((pid) => ({ id: pid, pn: pid, role: "participant" as const })),
    ];
    return delay({ id, subject: name });
  },

  // No real WAHA behind the demo — a fixed preview stands in for whatever group the pasted
  // code/link would actually resolve to.
  getGroupJoinInfo: (_code: string): Promise<GroupJoinInfo> =>
    delay({ id: "demo-preview-group@g.us", subject: "Demo group preview" }),

  joinGroup: (_code: string) => {
    const id = `demo-joined-${Date.now()}`;
    const chat: Chat = {
      id,
      name: "Joined demo group",
      avatarInitials: "JG",
      avatarColor: "#aebf92",
      isGroup: true,
      participantsCount: 6,
    };
    DEMO_CHATS.unshift(chat);
    DEMO_MESSAGES[id] = [];
    return delay({ id });
  },

  getGroup: (groupId: string): Promise<Group> => {
    const chat = DEMO_CHATS.find((c) => c.id === groupId);
    return delay({ id: groupId, subject: chat?.name ?? groupId });
  },

  deleteGroup: (groupId: string) => {
    const idx = DEMO_CHATS.findIndex((c) => c.id === groupId);
    if (idx !== -1) DEMO_CHATS.splice(idx, 1);
    delete DEMO_MESSAGES[groupId];
    delete DEMO_GROUP_PARTICIPANTS[groupId];
    return delay({ ok: true as const });
  },

  leaveGroup: (groupId: string) => {
    const idx = DEMO_CHATS.findIndex((c) => c.id === groupId);
    if (idx !== -1) DEMO_CHATS.splice(idx, 1);
    return delay({ ok: true as const });
  },

  // The public demo never has a real group photo — always fall back to the initials avatar.
  getGroupPicture: (_groupId: string) => delay({ url: null }),

  setGroupPicture: (_groupId: string, _file: OutgoingFile) => delay({ success: true as const }),

  deleteGroupPicture: (_groupId: string) => delay({ success: true as const }),

  setGroupSubject: (groupId: string, subject: string) => {
    const chat = DEMO_CHATS.find((c) => c.id === groupId);
    if (chat) chat.name = subject;
    return delay({ ok: true as const });
  },

  setGroupDescription: (groupId: string, description: string) => {
    DEMO_GROUP_DESCRIPTIONS[groupId] = description;
    return delay({ ok: true as const });
  },

  getGroupInfoAdminOnly: (groupId: string) =>
    delay({ adminsOnly: DEMO_GROUP_SETTINGS[groupId]?.infoAdminOnly ?? false }),

  setGroupInfoAdminOnly: (groupId: string, adminsOnly: boolean) => {
    (DEMO_GROUP_SETTINGS[groupId] ??= { infoAdminOnly: false, messagesAdminOnly: false }).infoAdminOnly =
      adminsOnly;
    return delay({ ok: true as const });
  },

  getGroupMessagesAdminOnly: (groupId: string) =>
    delay({ adminsOnly: DEMO_GROUP_SETTINGS[groupId]?.messagesAdminOnly ?? false }),

  setGroupMessagesAdminOnly: (groupId: string, adminsOnly: boolean) => {
    (DEMO_GROUP_SETTINGS[groupId] ??= {
      infoAdminOnly: false,
      messagesAdminOnly: false,
    }).messagesAdminOnly = adminsOnly;
    return delay({ ok: true as const });
  },

  getGroupInviteCode: (groupId: string) =>
    delay((DEMO_GROUP_INVITE_CODES[groupId] ??= demoInviteCode())),

  revokeGroupInviteCode: (groupId: string) => {
    DEMO_GROUP_INVITE_CODES[groupId] = demoInviteCode();
    return delay(DEMO_GROUP_INVITE_CODES[groupId]);
  },

  getGroupParticipants: (groupId: string): Promise<GroupParticipant[]> =>
    delay([...(DEMO_GROUP_PARTICIPANTS[groupId] ?? [])]),

  addGroupParticipants: (groupId: string, participantIds: string[]) => {
    const list = (DEMO_GROUP_PARTICIPANTS[groupId] ??= []);
    for (const id of participantIds) {
      if (!list.some((p) => p.id === id)) list.push({ id, pn: id, role: "participant" });
    }
    const chat = DEMO_CHATS.find((c) => c.id === groupId);
    if (chat) chat.participantsCount = list.length;
    return delay({ ok: true as const });
  },

  removeGroupParticipants: (groupId: string, participantIds: string[]) => {
    const list = DEMO_GROUP_PARTICIPANTS[groupId];
    if (list) DEMO_GROUP_PARTICIPANTS[groupId] = list.filter((p) => !participantIds.includes(p.id));
    const chat = DEMO_CHATS.find((c) => c.id === groupId);
    if (chat) chat.participantsCount = DEMO_GROUP_PARTICIPANTS[groupId]?.length;
    return delay({ ok: true as const });
  },

  promoteGroupParticipants: (groupId: string, participantIds: string[]) => {
    const list = DEMO_GROUP_PARTICIPANTS[groupId] ?? [];
    for (const p of list) if (participantIds.includes(p.id)) p.role = "admin";
    return delay({ ok: true as const });
  },

  demoteGroupParticipants: (groupId: string, participantIds: string[]) => {
    const list = DEMO_GROUP_PARTICIPANTS[groupId] ?? [];
    for (const p of list) if (participantIds.includes(p.id)) p.role = "participant";
    return delay({ ok: true as const });
  },

  // --- Profile (own account) ----------------------------------------------------------------

  getProfile: (): Promise<Profile> => delay({ ...DEMO_PROFILE }),

  setProfileName: (name: string) => {
    DEMO_PROFILE.name = name;
    return delay({ success: true as const });
  },

  // WAHA's own profile GET has no status field to read back (write-only from the API's
  // perspective) — the demo mirrors that honestly rather than faking a persisted value.
  setProfileStatus: (_status: string) => delay({ success: true as const }),

  setProfilePicture: (_file: OutgoingFile) => delay({ success: true as const }),

  deleteProfilePicture: () => delay({ success: true as const }),

  // --- Guard (anti-detection) ----------------------------------------------------------------

  // No real send-guard runs against demo data — always reports healthy rather than faking a
  // breaker trip that could never actually happen here.
  getGuardStatus: (): Promise<GuardStatus> =>
    delay({
      warmingUp: false,
      warmupEndsAt: 0,
      circuitBreaker: { open: false, openUntil: null, recentFailures: 0 },
    }),

  /** Mirrors the real search closely enough to be worth trying in the demo (same folding,
   *  same AND-ed terms, same snippet+highlight shape) but it is NOT the implementation: the
   *  real one — bounded index, TTL, WAHA paging — lives in
   *  `backend/src/search/message-index.ts` and is what the tests cover. Kept small and local
   *  here rather than shared, because the two run in different places for different reasons. */
  searchMessages: (query: string, opts: { chatId?: string; limit?: number } = {}) => {
    const terms = query
      .split(/\s+/)
      .map((t) => demoFold(t.replace(/"/g, "")))
      .filter(Boolean);
    const results: SearchHit[] = [];
    for (const chat of DEMO_CHATS) {
      if (opts.chatId && chat.id !== opts.chatId) continue;
      for (const message of DEMO_MESSAGES[chat.id] ?? []) {
        if (!message.body) continue;
        const folded = demoFold(message.body);
        if (!terms.every((t) => folded.includes(t))) continue;
        const at = folded.indexOf(terms[0]);
        results.push({
          chatId: chat.id,
          chatName: chat.name,
          messageId: message.id,
          timestamp: message.timestamp,
          fromMe: message.fromMe,
          snippet: message.body,
          highlights: [{ start: at, length: terms[0].length }],
        });
      }
    }
    results.sort((a, b) => b.timestamp - a.timestamp);
    const limited = results.slice(0, opts.limit ?? 60);
    return delay({
      query,
      terms,
      results: limited,
      stats: {
        chats: DEMO_CHATS.length,
        messages: Object.values(DEMO_MESSAGES).reduce((n, m) => n + m.length, 0),
        builtAt: Date.now(),
        buildMs: 0,
        partial: false,
        skippedChats: 0,
        searchMs: 1,
        matches: results.length,
      },
    });
  },
};
