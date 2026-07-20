'use client';

import { Check, Clock } from 'lucide-react';
import {
  EVIDENCE_STATUS_META,
  DEFAULT_EVIDENCE_STATUS,
  type EvidenceStatus,
} from '@/lib/admissions/journey';

/**
 * Light Stage-0 confirmation control. Everything the family enters is trusted
 * by default ('provided'); this lets them self-confirm an item, or mark it
 * 'planned' (hasn't happened yet). We are not verifiers — 'confirmed' means the
 * family attests it is accurate, nothing more.
 */
export function EvidenceControl({
  status = DEFAULT_EVIDENCE_STATUS,
  onChange,
  allowPlanned = true,
}: {
  status?: EvidenceStatus;
  onChange: (next: EvidenceStatus) => void;
  allowPlanned?: boolean;
}) {
  const opts: EvidenceStatus[] = allowPlanned
    ? ['provided', 'confirmed', 'planned']
    : ['provided', 'confirmed'];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] p-0.5" role="group" aria-label="Evidence status">
      {opts.map(opt => {
        const active = status === opt;
        const styles: Record<EvidenceStatus, string> = {
          provided: 'bg-white text-[var(--ink)] shadow-sm',
          confirmed: 'bg-emerald-500 text-white',
          planned: 'bg-amber-500 text-white',
        };
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            title={EVIDENCE_STATUS_META[opt].description}
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
              active ? styles[opt] : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {opt === 'confirmed' && <Check size={11} />}
            {opt === 'planned' && <Clock size={11} />}
            {EVIDENCE_STATUS_META[opt].label}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only chip for surfaces that display (not edit) an item's status. */
export function EvidenceChip({ status = DEFAULT_EVIDENCE_STATUS }: { status?: EvidenceStatus }) {
  const cls: Record<EvidenceStatus, string> = {
    provided: 'bg-[var(--bg-soft)] text-[var(--muted)] border-[var(--line)]',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    planned: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full border ${cls[status]}`}>
      {status === 'confirmed' && <Check size={10} />}
      {status === 'planned' && <Clock size={10} />}
      {EVIDENCE_STATUS_META[status].label}
    </span>
  );
}
