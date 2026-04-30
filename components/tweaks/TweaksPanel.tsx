'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Tweaks } from '@/types';

type RadioOption<T extends string> = { value: T; label: string };

function TweakRadio<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</div>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 rounded text-[12.5px] font-medium border transition-all duration-100 ${
              value === opt.value
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-white text-[var(--ink-soft)] border-[var(--line-strong)] hover:bg-[var(--bg-soft)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const { tweaks, setTweak } = useApp();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-[var(--ink)] text-white shadow-lg flex items-center justify-center hover:bg-[var(--ink-soft)] transition-colors"
        aria-label="Open Tweaks panel"
        data-tweaks-panel
      >
        <SlidersHorizontal size={16} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-[320px] z-50 bg-white border-l border-[var(--line)] shadow-drawer flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
              <div className="font-semibold text-[var(--ink)]">Tweaks</div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg-soft)]"
                aria-label="Close panel"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6">
              <div>
                <div className="text-[12px] font-semibold text-[var(--ink)] mb-3 pb-2 border-b border-[var(--line)]">Layout</div>
                <div className="flex flex-col gap-4">
                  <TweakRadio
                    label="Navigation"
                    value={tweaks.nav}
                    options={[{ value: 'top', label: 'Top' }, { value: 'sidebar', label: 'Sidebar' }]}
                    onChange={v => setTweak('nav', v as Tweaks['nav'])}
                  />
                  <TweakRadio
                    label="Density"
                    value={tweaks.density}
                    options={[{ value: 'comfortable', label: 'Comfy' }, { value: 'compact', label: 'Compact' }]}
                    onChange={v => setTweak('density', v as Tweaks['density'])}
                  />
                  <TweakRadio
                    label="Card style"
                    value={tweaks.cardStyle}
                    options={[{ value: 'bordered', label: 'Bordered' }, { value: 'shadow', label: 'Shadow' }]}
                    onChange={v => setTweak('cardStyle', v as Tweaks['cardStyle'])}
                  />
                </div>
              </div>
              <div>
                <div className="text-[12px] font-semibold text-[var(--ink)] mb-3 pb-2 border-b border-[var(--line)]">Accent</div>
                <TweakRadio
                  label="Color"
                  value={tweaks.accent}
                  options={[
                    { value: 'blue', label: 'Blue' },
                    { value: 'indigo', label: 'Indigo' },
                    { value: 'slate', label: 'Slate' },
                    { value: 'emerald', label: 'Emerald' },
                  ]}
                  onChange={v => setTweak('accent', v as Tweaks['accent'])}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
