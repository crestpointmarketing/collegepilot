export function FitBar({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--green-600)' : score >= 60 ? 'var(--amber-600)' : 'var(--muted-2)';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden flex-1">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[12px] tabular-nums font-semibold" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}
