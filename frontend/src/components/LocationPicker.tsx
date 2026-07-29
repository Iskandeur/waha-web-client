import { useState, type FormEvent } from "react";
import { MapPinIcon, SearchIcon } from "./icons.js";

interface PlaceResult {
  name: string;
  latitude: number;
  longitude: number;
}

/** Nominatim (OpenStreetMap's public geocoding search) — a browser-side call, same pattern as
 *  the Geolocation API used for "share my current location": neither one touches WAHA/the
 *  backend, so both work identically regardless of demo vs. real mode. No API key needed; kept
 *  to a handful of results per query out of courtesy to the free public service. */
async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const results = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return results.map((r) => ({
    name: r.display_name,
    latitude: Number.parseFloat(r.lat),
    longitude: Number.parseFloat(r.lon),
  }));
}

/** "Share a location" modal — offers the existing instant "my current position" (Geolocation
 *  API) alongside a new address/place search (the "carte" gap: `sendLocation` itself has
 *  worked since the v7 pass, but until now the only way to pick coordinates was your own GPS
 *  position, not an arbitrary searched-for place). Same overlay/card pattern as `ContactPicker`. */
export function LocationPicker({
  onSelect,
  onClose,
}: {
  onSelect: (latitude: number, longitude: number, name?: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function shareCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't available in this browser");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onSelect(pos.coords.latitude, pos.coords.longitude, "My location");
        onClose();
      },
      (err) => {
        setLocating(false);
        setError(err.message || "Couldn't get your location");
      },
      { timeout: 10_000 },
    );
  }

  async function submitSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchPlaces(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="contact-picker-overlay" onClick={onClose}>
      <div className="contact-picker location-picker" onClick={(e) => e.stopPropagation()}>
        <div className="contact-picker-title">Share a location</div>
        <button
          type="button"
          className="location-picker-current"
          onClick={shareCurrentLocation}
          disabled={locating}
        >
          <MapPinIcon size={16} />
          {locating ? "Getting your location…" : "Share my current location"}
        </button>
        <form className="contact-picker-search" onSubmit={submitSearch}>
          <SearchIcon size={15} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a place or address"
          />
        </form>
        {error && <div className="contact-picker-error">{error}</div>}
        {searching && <div className="contact-picker-empty">Searching…</div>}
        {!searching && results.length === 0 && query && !error && (
          <div className="contact-picker-empty">No places found. Try a different search.</div>
        )}
        <ul className="contact-picker-list">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="contact-picker-item location-picker-item"
                onClick={() => {
                  onSelect(r.latitude, r.longitude, r.name);
                  onClose();
                }}
              >
                <MapPinIcon size={20} />
                <div className="contact-picker-item-body">
                  <span className="contact-picker-item-name">{r.name}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="contact-picker-close" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
