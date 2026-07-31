/** Picks readable ink for an arbitrary avatar background: the Organic palette favors soft
 *  pastel fills (light) but real WAHA-sourced colors could be anything, so contrast is derived
 *  from perceived luminance rather than assumed — dark cream ink on light backgrounds, the
 *  page's cream on dark ones, matching how the design's fixed avatar tones pair color+ink. */
function inkFor(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "var(--color-bg)";
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.62 ? "var(--color-neutral-900)" : "var(--color-bg)";
}

export function Avatar({
  initials,
  color,
  size = 48,
  src,
}: {
  initials: string;
  color: string;
  size?: number;
  src?: string | null;
}) {
  if (src) {
    return (
      <img
        className="avatar avatar-picture"
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: color,
        color: inkFor(color),
        fontSize: size * 0.38,
      }}
    >
      {initials}
    </div>
  );
}
