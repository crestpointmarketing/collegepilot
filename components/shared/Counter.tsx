'use client';

export function Counter({ value, max }: { value: string; max: number }) {
  const len = (value || '').length;
  const over = len > max;
  const warn = !over && len > max * 0.85;

  return (
    <span
      className={`text-[11.5px] tabular-nums font-medium ${over ? 'text-red-600 font-bold' : warn ? 'text-amber-600' : 'text-[var(--muted-2)]'}`}
    >
      {len}/{max}
    </span>
  );
}
