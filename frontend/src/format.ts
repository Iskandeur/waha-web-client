export function formatClockTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function yesterday(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  return d;
}

/** Chat-list-row timestamp: clock time for today, "Yesterday", else a short date. */
export function formatListTimestamp(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const now = new Date();
  if (isSameDay(d, now)) return formatClockTime(unixSeconds);
  if (isSameDay(d, yesterday(now))) return "Yesterday";
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Thread date-separator pill: "Today" / "Yesterday" / full weekday+date. */
export function formatDateSeparator(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const now = new Date();
  if (isSameDay(d, now)) return "Today";
  if (isSameDay(d, yesterday(now))) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

export function isSameCalendarDay(aUnixSeconds: number, bUnixSeconds: number): boolean {
  return isSameDay(new Date(aUnixSeconds * 1000), new Date(bUnixSeconds * 1000));
}

export interface PreviewSource {
  type: string;
  body: string;
  mediaName?: string;
  durationSec?: number;
}

/** One-line preview for the chat list and for a message's own summary — media types get a
 *  short icon+label instead of raw body text. */
export function messagePreview(m: PreviewSource): string {
  switch (m.type) {
    case "image":
      return m.body ? `📷 ${m.body}` : "📷 Photo";
    case "file":
      return `📄 ${m.mediaName ?? "File"}`;
    case "voice":
      return `🎤 Voice message${m.durationSec ? ` · 0:${String(m.durationSec).padStart(2, "0")}` : ""}`;
    case "video":
      return m.body ? `🎥 ${m.body}` : "🎥 Video";
    default:
      return m.body;
  }
}

/** Turns WAHA's `lastKnownPresence`/`lastSeen` pair into the same short strings the demo's
 *  canned `Chat.presence` text uses ("online" / "last seen today at 09:14"), so ChatHeader can
 *  treat real and demo presence identically. */
export function formatPresence(lastKnownPresence: string, lastSeen: number | null): string {
  if (lastKnownPresence === "online") return "online";
  if (lastKnownPresence === "typing") return "typing…";
  if (lastKnownPresence === "recording") return "recording audio…";
  if (lastSeen == null) return "offline";
  const d = new Date(lastSeen * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `last seen today at ${time}` : `last seen ${d.toLocaleDateString()} at ${time}`;
}
