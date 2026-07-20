'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, Check, AlertCircle, Lightbulb } from 'lucide-react';
import {
  HYPOTHESIS_KIND_META,
  isValidConvergence,
  type PositioningHypothesis,
  type ConfirmedDirection,
  type DirectionRole,
  type HypothesisValidation,
  type StudentReaction,
} from '@/lib/admissions/journey';
import { ConfidenceChip } from '@/components/assessment/ui';

/**
 * Stage-1 validation. The student reacts to each AI-proposed hypothesis with a
 * single control that doubles as convergence: Not me / Explore / Secondary /
 * Primary. Exactly one Primary (+ ≤1 Secondary) is required to confirm — the
 * "one core identity, not five personas" guard.
 */

type Choice = 'none' | 'exploratory' | 'secondary' | 'primary';

const CHOICES: { key: Choice; label: string }[] = [
  { key: 'none', label: 'Not me' },
  { key: 'exploratory', label: 'Explore' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'primary', label: 'Primary' },
];

const CHOICE_STYLE: Record<Choice, string> = {
  none: 'bg-[var(--bg-soft)] text-[var(--muted)]',
  exploratory: 'bg-blue-500 text-white',
  secondary: 'bg-teal-500 text-white',
  primary: 'bg-emerald-500 text-white',
};

const REACTION_FOR: Record<Choice, StudentReaction> = {
  none: 'not_me',
  exploratory: 'explore',
  secondary: 'partly',
  primary: 'feels_like_me',
};

export function PositioningPanel({
  hypotheses,
  initialConfirmed,
  onConfirm,
  onRegenerate,
  saving = false,
}: {
  hypotheses: PositioningHypothesis[];
  initialConfirmed: ConfirmedDirection[];
  onConfirm: (confirmed: ConfirmedDirection[], validations: HypothesisValidation[]) => void;
  onRegenerate: () => void;
  saving?: boolean;
}) {
  const seed: Record<string, Choice> = {};
  for (const c of initialConfirmed) seed[c.hypothesisId] = c.role;
  const [choices, setChoices] = useState<Record<string, Choice>>(seed);

  const confirmed: ConfirmedDirection[] = hypotheses
    .map(h => ({ hypothesisId: h.id, role: (choices[h.id] ?? 'none') as Choice }))
    .filter((c): c is { hypothesisId: string; role: DirectionRole } => c.role !== 'none');

  const primaryCount = confirmed.filter(c => c.role === 'primary').length;
  const valid = isValidConvergence(confirmed);

  const hint = primaryCount === 0
    ? 'Pick exactly one Primary — your core identity.'
    : primaryCount > 1
      ? 'Only one Primary allowed — a strong application has one core identity, not several.'
      : confirmed.filter(c => c.role === 'secondary').length > 1
        ? 'At most one Secondary.'
        : 'Ready to confirm.';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-[var(--accent-100)] px-6 py-5" style={{ background: 'var(--accent-50)' }}>
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Lightbulb size={16} />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Stage 1 · Identity — you decide</span>
        </div>
        <p className="text-[14px] text-[var(--ink)] mt-2 leading-relaxed max-w-2xl">
          These are evidence-backed <strong>hypotheses</strong>, not conclusions. React to each one. Choose the single reading that feels most like you as <strong>Primary</strong>; mark others Secondary, Explore, or Not me.
        </p>
      </div>

      {hypotheses.map(h => {
        const choice = choices[h.id] ?? 'none';
        return (
          <div key={h.id} className={`bg-white rounded-card shadow-card border overflow-hidden ${choice === 'primary' ? 'border-emerald-300' : 'border-[var(--line)]'}`}>
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">{HYPOTHESIS_KIND_META[h.kind].label}</span>
                  <ConfidenceChip level={h.confidence} />
                </div>
              </div>
              <h3 className="text-[19px] font-semibold text-[var(--ink)] tracking-tight mt-1.5">{h.label}</h3>

              <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 mt-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Supporting evidence</div>
                  <ul className="flex flex-col gap-1">
                    {h.supportingEvidence.map((e, i) => (
                      <li key={i} className="text-[13px] text-[var(--ink)] leading-relaxed flex gap-2"><Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />{e}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-3">
                  {h.missingEvidence.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Still missing</div>
                      <ul className="flex flex-col gap-1">
                        {h.missingEvidence.map((e, i) => <li key={i} className="text-[12.5px] text-[var(--muted)] leading-relaxed">— {e}</li>)}
                      </ul>
                    </div>
                  )}
                  {h.fieldTypes.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Leads to</div>
                      <div className="flex flex-wrap gap-1.5">
                        {h.fieldTypes.map((f, i) => <span key={i} className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--bg-soft)] border border-[var(--line)] text-[var(--ink-soft)]">{f}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {h.narrativeRisk && (
                <p className="text-[12.5px] text-[var(--muted)] mt-3 leading-relaxed"><span className="font-semibold text-amber-600">Risk:</span> {h.narrativeRisk}</p>
              )}
            </div>

            <div className="px-6 py-3 border-t border-[var(--line)] bg-[var(--bg-soft)] flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[12px] text-[var(--muted)]">Does this feel like you?</span>
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--line)] bg-white p-0.5">
                {CHOICES.map(c => {
                  const active = choice === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setChoices(prev => ({ ...prev, [h.id]: c.key }))}
                      aria-pressed={active}
                      className={`text-[12px] font-semibold px-2.5 py-1 rounded-md transition-colors ${active ? CHOICE_STYLE[c.key] : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-3 flex-wrap sticky bottom-4 bg-white rounded-card shadow-card border border-[var(--line)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          {valid
            ? <Check size={16} className="text-emerald-500 shrink-0" />
            : <AlertCircle size={16} className="text-amber-500 shrink-0" />}
          <span className={`text-[13px] ${valid ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>{hint}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--line-strong)] text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} /> New hypotheses
          </button>
          <button
            onClick={() => onConfirm(confirmed, hypotheses.map(h => ({ hypothesisId: h.id, reaction: REACTION_FOR[choices[h.id] ?? 'none'] } as HypothesisValidation)))}
            disabled={!valid || saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-white text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)' }}
          >
            <Sparkles size={15} /> Confirm identity
          </button>
        </div>
      </div>
    </div>
  );
}
