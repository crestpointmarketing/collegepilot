'use client';

interface ChipGroupProps {
  options: string[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
}

export function ChipGroup({ options, value, onChange, multi = true }: ChipGroupProps) {
  const selected = new Set(Array.isArray(value) ? value : [value].filter(Boolean));

  const toggle = (opt: string) => {
    if (multi) {
      const next = new Set(selected);
      next.has(opt) ? next.delete(opt) : next.add(opt);
      onChange(Array.from(next));
    } else {
      onChange(opt);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1 rounded-pill text-[12.5px] font-medium border transition-all duration-100 ${
            selected.has(opt)
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-white text-[var(--ink-soft)] border-[var(--line-strong)] hover:bg-[var(--bg-soft)]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
