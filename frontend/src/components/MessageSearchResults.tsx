import { type SearchHit, type SearchStats } from "../api.js";
import { formatListTimestamp } from "../format.js";

/** Renders a snippet with the backend's highlight offsets applied. The offsets are computed
 *  server-side against the original (accented) text, so this stays a dumb slicer — no second,
 *  subtly-different matcher living in the UI. */
function HighlightedSnippet({ hit }: { hit: SearchHit }) {
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (const { start, length } of hit.highlights) {
    if (start < cursor) continue; // overlapping terms: keep the first, skip the rest
    if (start > cursor) parts.push({ text: hit.snippet.slice(cursor, start), match: false });
    parts.push({ text: hit.snippet.slice(start, start + length), match: true });
    cursor = start + length;
  }
  parts.push({ text: hit.snippet.slice(cursor), match: false });
  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="search-hit-mark">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function MessageSearchResults({
  query,
  results,
  stats,
  loading,
  error,
  onSelect,
}: {
  query: string;
  results: SearchHit[];
  stats: SearchStats | null;
  loading: boolean;
  error: string | null;
  onSelect: (hit: SearchHit) => void;
}) {
  return (
    <div className="search-results">
      <div className="search-results-header">
        <span>Messages</span>
        {loading && <span className="search-results-meta">searching…</span>}
        {!loading && stats && (
          <span className="search-results-meta">
            {stats.matches} in {stats.messages.toLocaleString()} messages · {stats.searchMs}ms
          </span>
        )}
      </div>

      {error && <div className="search-results-error">{error}</div>}

      {!error && !loading && results.length === 0 && (
        <div className="search-results-empty">No message contains “{query}”.</div>
      )}

      <ul className="search-hit-list">
        {results.map((hit) => (
          <li
            key={`${hit.chatId}:${hit.messageId}`}
            className="search-hit"
            role="button"
            tabIndex={0}
            onClick={() => onSelect(hit)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect(hit);
            }}
          >
            <div className="search-hit-row">
              <span className="search-hit-chat">{hit.chatName}</span>
              <span className="search-hit-time">{formatListTimestamp(hit.timestamp)}</span>
            </div>
            <div className="search-hit-snippet">
              {hit.fromMe && <span className="search-hit-you">You: </span>}
              <HighlightedSnippet hit={hit} />
            </div>
          </li>
        ))}
      </ul>

      {/* Honest about the bound rather than implying the whole archive was searched — the
          backend indexes the most recent chats, a couple of history pages each. */}
      {!loading && stats?.partial && (
        <div className="search-results-note">
          Searched the {stats.chats} most recent chats ({stats.messages.toLocaleString()} messages).
          Older history isn’t indexed.
        </div>
      )}
    </div>
  );
}
