'use client';

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

export function Avatar({ name, color, size = 30 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: size * 0.38,
        minWidth: size,
      }}
      className="rounded-full flex items-center justify-center font-semibold text-white select-none"
    >
      {initials}
    </div>
  );
}
