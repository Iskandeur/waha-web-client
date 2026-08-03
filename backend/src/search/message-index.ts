/** Full-text search over conversation history.
 *
 *  WAHA has no search endpoint: the only way to look inside messages is to page through each
 *  chat's history one HTTP call at a time. So this module keeps an in-memory index — built
 *  lazily on the first search, reused until it goes stale — rather than re-walking history on
 *  every keystroke. That single design choice is what makes search cheap for the user *and*
 *  quiet on the WAHA side, which matters here: reads are throttled by the same circuit breaker
 *  as everything else (see waha-client.ts), and a burst of a hundred parallel reads is exactly
 *  the kind of traffic the anti-detection guard exists to avoid.
 *
 *  The index is deliberately bounded (`DEFAULT_OPTIONS`): the N most recent chats, a couple of
 *  pages of history each. Search results say so (`stats.partial`) instead of pretending the
 *  whole archive was searched — WhatsApp multi-device sessions don't even hold the full history
 *  locally, so "we searched everything" would be a lie no matter how hard we paged. */

import type { WahaChat, WahaMessage } from "../waha-client.js";

export interface IndexedMessage {
  chatId: string;
  chatName: string;
  id: string;
  timestamp: number;
  fromMe: boolean;
  body: string;
}

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
  /** A window of the message body around the first match — not the whole message. */
  snippet: string;
  /** Offsets *into `snippet`*, so the frontend highlights without re-running the matcher. */
  highlights: Highlight[];
}

export interface IndexStats {
  chats: number;
  messages: number;
  builtAt: number;
  buildMs: number;
  /** True when the index covers only part of the history (chat cap or page cap hit). */
  partial: boolean;
  /** Chats whose history couldn't be fetched (WAHA error) — excluded from results. */
  skippedChats: number;
}

export interface SearchResponse {
  query: string;
  terms: string[];
  results: SearchHit[];
  stats: IndexStats & { searchMs: number; matches: number };
}

/** Everything the index needs from the outside world, injected so tests never touch WAHA. */
export interface IndexSource {
  listChats(): Promise<WahaChat[]>;
  getMessages(chatId: string, limit: number, offset: number): Promise<WahaMessage[]>;
}

export interface IndexOptions {
  /** Most-recent chats to index (WAHA returns the overview newest-first). */
  maxChats: number;
  /** History pages to walk per chat. `maxChats * pagesPerChat` = worst-case WAHA calls. */
  pagesPerChat: number;
  pageSize: number;
  /** How long a built index stays usable before the next search rebuilds it. */
  ttlMs: number;
  /** Spacing between WAHA calls — deliberate politeness, not a rate limit. */
  pauseMs: number;
  maxResults: number;
  snippetRadius: number;
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const DEFAULT_OPTIONS: IndexOptions = {
  maxChats: 25,
  pagesPerChat: 2,
  pageSize: 100,
  ttlMs: 5 * 60 * 1000,
  pauseMs: 120,
  maxResults: 60,
  snippetRadius: 70,
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Case- and accent-insensitive folding, with a map back to the original string's offsets.
 *
 *  Folding one character at a time (rather than `String.prototype.normalize` on the whole
 *  string) is what makes the offsets usable: NFD turns "é" into two code units and "ß"
 *  lowercases to two characters, so a naive fold would shift every highlight after the first
 *  accent. Here each folded character remembers which original index it came from. */
export function foldWithMap(text: string): { folded: string; map: number[] } {
  const parts: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const folded = text[i]
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    for (const ch of folded) {
      parts.push(ch);
      map.push(i);
    }
  }
  return { folded: parts.join(""), map };
}

export function fold(text: string): string {
  return foldWithMap(text).folded;
}

/** `hello world` -> two AND-ed terms; `"hello world"` -> one phrase. Quoting is the only
 *  syntax — no boolean operators, because a search box that needs a manual isn't a search box. */
export function parseQuery(query: string): string[] {
  const terms: string[] = [];
  const pattern = /"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(query)) !== null) {
    const term = fold(match[1] ?? match[2] ?? "").trim();
    if (term) terms.push(term);
  }
  return terms;
}

/** All terms must be present (AND). Returns the matched ranges in *original* coordinates,
 *  or null when the message doesn't match. */
export function matchRanges(body: string, terms: string[]): Highlight[] | null {
  if (terms.length === 0) return null;
  const { folded, map } = foldWithMap(body);
  const ranges: Highlight[] = [];
  for (const term of terms) {
    let from = 0;
    let found = false;
    for (;;) {
      const at = folded.indexOf(term, from);
      if (at === -1) break;
      found = true;
      const start = map[at];
      const end = map[at + term.length - 1] + 1;
      ranges.push({ start, length: end - start });
      from = at + term.length;
    }
    if (!found) return null;
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** A window around the first match, with the highlights rebased onto the window. */
export function buildSnippet(
  body: string,
  ranges: Highlight[],
  radius: number,
): { snippet: string; highlights: Highlight[] } {
  const first = ranges[0];
  const rawStart = Math.max(0, first.start - radius);
  const rawEnd = Math.min(body.length, first.start + first.length + radius);
  const prefix = rawStart > 0 ? "…" : "";
  const suffix = rawEnd < body.length ? "…" : "";
  const snippet = prefix + body.slice(rawStart, rawEnd) + suffix;
  const shift = prefix.length - rawStart;
  const highlights = ranges
    .filter((r) => r.start >= rawStart && r.start + r.length <= rawEnd)
    .map((r) => ({ start: r.start + shift, length: r.length }));
  return { snippet, highlights };
}

/** WAHA's chat overview has no stable display-name field for every chat kind — `name` is set
 *  for contacts and groups it knows, and the bare JID is the honest fallback (better than an
 *  empty label in a results list). */
function chatLabel(chat: WahaChat): string {
  const name = typeof chat.name === "string" ? chat.name.trim() : "";
  return name || chat.id;
}

export function createMessageIndex(source: IndexSource, overrides: Partial<IndexOptions> = {}) {
  const options: IndexOptions = { ...DEFAULT_OPTIONS, ...overrides };

  let entries: IndexedMessage[] = [];
  let stats: IndexStats = {
    chats: 0,
    messages: 0,
    builtAt: 0,
    buildMs: 0,
    partial: false,
    skippedChats: 0,
  };
  /** Concurrent searches share one build instead of each starting their own WAHA walk. */
  let building: Promise<void> | null = null;
  /** Explicit rather than inferred from `stats.builtAt`, which is a legitimate 0 on an
   *  injected clock (and would then make a freshly built index look like it was never built). */
  let built = false;

  async function build(): Promise<void> {
    const startedAt = options.now();
    const chats = await source.listChats();
    const selected = chats.slice(0, options.maxChats);
    const collected: IndexedMessage[] = [];
    let skipped = 0;
    let partial = chats.length > options.maxChats;
    let lastError: unknown = null;
    let hasFetched = false;

    for (const chat of selected) {
      const label = chatLabel(chat);
      // Keep each chat isolated until every requested page succeeds. Otherwise a failure on
      // page two would mark the chat as skipped while quietly leaving page one's messages in
      // the searchable index — contradictory stats and an incomplete result set presented as
      // valid. A skipped chat contributes nothing; the other chats still remain searchable.
      const chatEntries: IndexedMessage[] = [];
      try {
        for (let page = 0; page < options.pagesPerChat; page++) {
          // Pace the whole WAHA walk, not only consecutive pages within one chat. Most chats
          // have a short first page; sleeping after full pages alone would still fire one read
          // per chat back-to-back — exactly the cross-chat burst this index is meant to avoid.
          if (hasFetched && options.pauseMs > 0) await options.sleep(options.pauseMs);
          hasFetched = true;
          const messages = await source.getMessages(
            chat.id,
            options.pageSize,
            page * options.pageSize,
          );
          for (const message of messages) {
            if (typeof message.body !== "string" || message.body.length === 0) continue;
            chatEntries.push({
              chatId: chat.id,
              chatName: label,
              id: message.id,
              timestamp: message.timestamp,
              fromMe: Boolean(message.fromMe),
              body: message.body,
            });
          }
          // A short page means we reached the end of what WAHA holds for this chat; a full
          // page on the last iteration means there is more history we chose not to walk.
          if (messages.length < options.pageSize) break;
          if (page === options.pagesPerChat - 1) partial = true;
        }
        collected.push(...chatEntries);
      } catch (err) {
        // One unreachable chat shouldn't cost the user every other result — but if *nothing*
        // could be indexed, the error is rethrown below rather than reported as "no matches".
        skipped++;
        lastError = err;
      }
    }

    if (skipped > 0 && skipped === selected.length) throw lastError;

    entries = collected;
    built = true;
    stats = {
      chats: selected.length - skipped,
      messages: collected.length,
      builtAt: options.now(),
      buildMs: options.now() - startedAt,
      partial,
      skippedChats: skipped,
    };
  }

  async function ensureBuilt(force = false): Promise<void> {
    const fresh = built && options.now() - stats.builtAt < options.ttlMs;
    if (fresh && !force) return;
    if (!building) {
      building = build().finally(() => {
        building = null;
      });
    }
    await building;
  }

  async function search(
    query: string,
    opts: { chatId?: string; limit?: number; refresh?: boolean } = {},
  ): Promise<SearchResponse> {
    const terms = parseQuery(query);
    if (terms.length === 0) {
      return {
        query,
        terms,
        results: [],
        stats: { ...stats, searchMs: 0, matches: 0 },
      };
    }

    await ensureBuilt(opts.refresh);
    const startedAt = options.now();
    const limit = Math.min(opts.limit ?? options.maxResults, options.maxResults);
    const scope = opts.chatId ? entries.filter((e) => e.chatId === opts.chatId) : entries;

    const hits: SearchHit[] = [];
    for (const entry of scope) {
      const ranges = matchRanges(entry.body, terms);
      if (!ranges) continue;
      const { snippet, highlights } = buildSnippet(entry.body, ranges, options.snippetRadius);
      hits.push({
        chatId: entry.chatId,
        chatName: entry.chatName,
        messageId: entry.id,
        timestamp: entry.timestamp,
        fromMe: entry.fromMe,
        snippet,
        highlights,
      });
    }
    hits.sort((a, b) => b.timestamp - a.timestamp);

    return {
      query,
      terms,
      results: hits.slice(0, limit),
      stats: { ...stats, searchMs: options.now() - startedAt, matches: hits.length },
    };
  }

  return { search, ensureBuilt, stats: () => stats };
}

export type MessageIndex = ReturnType<typeof createMessageIndex>;
