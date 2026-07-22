'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Compass, Sparkles, AlertTriangle, Loader2, CheckCircle2, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  PageHeader, Card, Chip, AlertCard, EmptyState, PrimaryButton, GhostButton, Eyebrow, type Tone,
} from '@/components/ui';
import {
  isPositioningConfirmed, isDirectionConfirmed,
  DIRECTION_CATEGORY_META,
  type DirectionState, type DirectionSelection, type FitLevel, type DirectionRole,
} from '@/lib/admissions/journey';

const FIT: Record<FitLevel, { pct: number; bar: string; label: string }> = {
  Excellent: { pct: 92, bar: 'bg-[#16A34A]', label: 'Excellent' },
  Strong:    { pct: 78, bar: 'bg-[#16A34A]', label: 'Strong' },
  Moderate:  { pct: 58, bar: 'bg-[var(--accent)]', label: 'Moderate' },
  Limited:   { pct: 35, bar: 'bg-[#D97706]', label: 'Limited' },
  Unknown:   { pct: 18, bar: 'bg-[var(--muted-2)]', label: 'Unknown' },
};
const CAT_TONE: Record<string, Tone> = { direct_fit: 'positive', interdisciplinary: 'accent', strategic_adjacent: 'info', not_recommended: 'neutral' };

type Choice = 'none' | 'exploratory' | 'secondary' | 'primary';
const CHOICES: { key: Choice; label: string }[] = [
  { key: 'none', label: '—' }, { key: 'exploratory', label: 'Explore' }, { key: 'secondary', label: 'Secondary' }, { key: 'primary', label: 'Primary' },
];
const CHOICE_STYLE: Record<Choice, string> = {
  none: 'bg-[var(--bg-soft)] text-[var(--muted)]', exploratory: 'bg-blue-500 text-white', secondary: 'bg-teal-500 text-white', primary: 'bg-emerald-500 text-white',
};

function repairJson(input: string): string {
  let inS = false, esc = false, out = '';
  for (const c of input) {
    if (esc) { out += c; esc = false; continue; }
    if (c === '\\' && inS) { out += c; esc = true; continue; }
    if (c === '"') { inS = !inS; out += c; continue; }
    if (inS && (c === '\n' || c === '\r' || c === '\t')) { out += ' '; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export default function DirectionPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, saveStudentDraft } = useApp();
  const student = students.find(s => s.id === studentId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const direction = student?.direction;
  const [roles, setRoles] = useState<Record<string, Choice>>(() => {
    const seed: Record<string, Choice> = {};
    for (const s of direction?.selected ?? []) seed[s.directionId] = s.role;
    return seed;
  });
  const [saving, setSaving] = useState(false);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  const firstName = student.name.split(' ')[0];
  const identityReady = isPositioningConfirmed(student.positioning);

  async function generate() {
    if (!student || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/direction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Server error ${res.status}`); }
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let full = '';
      for (;;) { const { done, value } = await reader.read(); if (done) break; full += dec.decode(value, { stream: true }); }
      const m = full.match(/\{[\s\S]*\}/); if (!m) throw new Error('Invalid response from server.');
      const raw = JSON.parse(repairJson(m[0])) as Partial<DirectionState> & { error?: string };
      if (raw.error) throw new Error(raw.error);
      if (!raw.directions?.length) throw new Error('No directions were returned. Please try again.');
      const next: DirectionState = { generatedAt: raw.generatedAt ?? new Date().toISOString(), directions: raw.directions, selected: [] };
      await saveStudentDraft({ ...student, direction: next });
      setRoles({});
    } catch (e) { setError(e instanceof Error ? e.message : 'Direction generation failed.'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!student || !direction || saving) return;
    const selected: DirectionSelection[] = Object.entries(roles)
      .filter(([, r]) => r !== 'none')
      .map(([directionId, r]) => ({ directionId, role: r as DirectionRole }));
    setSaving(true);
    setError(null);
    const ok = await saveStudentDraft({ ...student, direction: { ...direction, selected } });
    setSaving(false);
    if (!ok) {
      setError('Could not save your direction — your session may have expired. Refresh the page, sign in again, and confirm once more.');
    }
  }

  const primaryCount = Object.values(roles).filter(r => r === 'primary').length;
  const valid = primaryCount === 1;
  const confirmedNow = isDirectionConfirmed(direction);

  const header = (
    <PageHeader
      title="Academic Direction"
      sub="Translating your identity into majors and program types — before school selection"
      actions={confirmedNow ? <Chip tone="positive"><Check size={11} /> Direction set</Chip> : undefined}
    />
  );

  if (!identityReady) {
    return (
      <div className="animate-fade-in max-w-[1080px] mx-auto">
        {header}
        <EmptyState
          icon={<Compass size={24} />}
          title="Confirm your identity first"
          body={`Academic directions are built from ${firstName}'s confirmed identity. Validate a positioning on the Blueprint page to unlock this step.`}
          action={<PrimaryButton href={`/students/${studentId}/blueprint`}>Go to Blueprint <ArrowRight size={15} /></PrimaryButton>}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      {header}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" /><p className="text-[13px] text-red-700">{error}</p>
        </div>
      )}

      {busy ? (
        <div className="bg-white rounded-card shadow-card border border-[var(--line)] px-8 py-10">
          <div className="flex items-center gap-2.5"><Loader2 size={18} className="text-[var(--accent)] animate-spin" /><span className="text-[15px] font-semibold text-[var(--ink)]">Recommending academic directions…</span></div>
        </div>
      ) : !direction?.directions?.length ? (
        <EmptyState
          icon={<Compass size={24} />}
          title={`Recommend ${firstName}'s academic directions`}
          body="From the confirmed identity, the system proposes major and program types — direct-fit, interdisciplinary, and strategic-adjacent — with the preparation gaps for each. No schools yet."
          action={<PrimaryButton onClick={generate}><Sparkles size={16} /> Recommend directions</PrimaryButton>}
        />
      ) : (
        <>
          <AlertCard tone="info" title="School names appear in the next step." body="This page focuses on what kind of program fits you best — not where it is offered." />
          <div className="mt-5 flex flex-col gap-4">
            {direction.directions.map(d => {
              const selectable = d.category !== 'not_recommended';
              const choice = roles[d.id] ?? 'none';
              return (
                <Card key={d.id} className={choice === 'primary' ? 'border-emerald-300' : ''} bodyClassName="px-6 py-5">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Chip tone={CAT_TONE[d.category] ?? 'neutral'}>{DIRECTION_CATEGORY_META[d.category].tag}</Chip>
                    <span className="text-[11px] text-[var(--muted)]">Leverage: {d.admissionsLeverage}</span>
                  </div>
                  <h3 className="text-[18px] font-bold text-[var(--ink)]">{d.title}</h3>
                  <p className="text-[12.5px] text-[var(--muted)] mt-0.5 leading-relaxed">{d.chain}</p>
                  {d.reason && <p className="text-[13px] text-[var(--ink)] mt-2 leading-relaxed">{d.reason}</p>}

                  {d.fitAxes.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      {d.fitAxes.map((ax, i) => {
                        const f = FIT[ax.level] ?? FIT.Moderate;
                        return (
                          <div key={i} className="bg-[var(--bg-soft)] rounded-lg p-3">
                            <p className="text-[11px] text-[var(--muted)] mb-1">{ax.label}</p>
                            <div className="h-1.5 bg-[var(--bg-deep)] rounded-full overflow-hidden mb-1"><div className={`h-full rounded-full ${f.bar}`} style={{ width: `${f.pct}%` }} /></div>
                            <p className="text-[12px] font-semibold text-[var(--ink)]">{f.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    {d.adjacent.length > 0 && (
                      <div>
                        <Eyebrow>Adjacent directions</Eyebrow>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {d.adjacent.map((a, i) => <span key={i} className="px-2.5 py-1 bg-[var(--accent-50)] text-[var(--accent)] text-[12px] rounded-full">{a}</span>)}
                        </div>
                      </div>
                    )}
                    {d.preparationGaps.length > 0 && (
                      <div>
                        <Eyebrow>Preparation gaps</Eyebrow>
                        <div className="mt-1.5 flex flex-col gap-1">
                          {d.preparationGaps.map((g, i) => <p key={i} className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]"><AlertTriangle size={11} className="text-[#D97706] shrink-0" /> {g}</p>)}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectable && (
                    <div className="mt-4 pt-4 border-t border-[var(--line)] flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-[12px] text-[var(--muted)]">Choose this direction?</span>
                      <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] p-0.5">
                        {CHOICES.map(c => (
                          <button key={c.key} type="button" onClick={() => setRoles(p => ({ ...p, [d.id]: c.key }))}
                            className={`text-[12px] font-semibold px-2.5 py-1 rounded-md transition-colors ${choice === c.key ? CHOICE_STYLE[c.key] : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap sticky bottom-4 mt-4 bg-white rounded-card shadow-card border border-[var(--line)] px-5 py-3.5">
            <div className="flex items-center gap-2 min-w-0">
              {error ? <AlertCircle size={16} className="text-red-500 shrink-0" />
                : confirmedNow ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                : valid ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                : <AlertCircle size={16} className="text-amber-500 shrink-0" />}
              <span className={`text-[13px] ${error ? 'text-red-600' : confirmedNow || valid ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                {error ? error
                  : confirmedNow ? 'Direction confirmed — continue to Programs & Schools.'
                  : primaryCount === 0 ? 'Pick exactly one Primary direction.'
                  : primaryCount > 1 ? 'Only one Primary allowed.'
                  : 'Ready to confirm.'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {confirmedNow ? (
                <>
                  <GhostButton onClick={confirm} className={!valid || saving ? 'opacity-40 pointer-events-none' : ''}>
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Update
                  </GhostButton>
                  <PrimaryButton href={`/students/${studentId}/programs`}>Continue to Programs &amp; Schools <ArrowRight size={15} /></PrimaryButton>
                </>
              ) : (
                <PrimaryButton onClick={confirm} className={!valid || saving ? 'opacity-40 pointer-events-none' : ''}>
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Confirm direction
                </PrimaryButton>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
