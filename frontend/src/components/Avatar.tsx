export function Avatar({
  initials,
  color,
  size = 48,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
