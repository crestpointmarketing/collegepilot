'use client';

export function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return null;

  const dotColor = state === 'saving' ? 'bg-amber-500' : 'bg-green-500';
  const label = state === 'saving' ? 'Saving…' : 'Saved';

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
      <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse2`} />
      {label}
    </span>
  );
}
