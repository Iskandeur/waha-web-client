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
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
