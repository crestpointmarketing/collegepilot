'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ScrollText, Sparkles, RefreshCw, Loader2, CheckCircle2, Compass, Pencil, Printer } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageHeader, PrimaryButton, GhostButton, AlertCard, EmptyState } from '@/components/ui';
import { BlueprintDocument } from '@/components/blueprint/BlueprintDocument';
import { PositioningPanel } from '@/components/blueprint/PositioningPanel';
import type { Blueprint } from '@/lib/admissions/blueprint';
import {
  isPositioningConfirmed,
  HYPOTHESIS_KIND_META,
  type PositioningState,
  type ConfirmedDirection,
  type HypothesisValidation,
} from '@/lib/admissions/journey';

const LOADING_STEPS = [
  'Reading the profile and computed assessment',
  'Designing the core identity and distinctive capability',
  'Building the operating system and brand DNA',
  'Positioning against the applicant archetype',
  'Drafting the future-self direction',
  'Collecting the master claim register',
];

const POS_STEPS = [
  'Reading the profile and computed assessment',
  'Finding the reading most consistent with the evidence',
  'Exploring strategic and interdisciplinary angles',
  'Naming what each reading still needs',
];

/** Strip control chars inside strings + trailing commas (mirrors strategy page). */
function repairJson(input: string): string {
  let inString = false;
  let escaped = false;
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escaped) { out += c; escaped = false; continue; }
    if (c === '\\' && inString) { out += c; escaped = true; continue; }
    if (c === '"') { inString = !inString; out += c; continue; }
    if (inString && (c === '\n' || c === '\r')) { out += ' '; continue; }
    if (inString && c === '\t') { out += ' '; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

async function streamJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `Server error ${res.status}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }
  const m = full.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Invalid response from server${full.trim() ? `: ${full.trim().slice(0, 240)}` : ''}`);
  const raw: unknown = JSON.parse(repairJson(m[0]));
  if (raw && typeof raw === 'object' && 'error' in raw) throw new Error(String((raw as { error: unknown }).error));
  return raw;
}

function isBlueprint(v: unknown): v is Blueprint {
  return !!v && typeof v === 'object' && (v as Blueprint).version === 1 && !!(v as Blueprint).identity;
}

function LoadingCard({ title, steps, step }: { title: string; steps: string[]; step: number }) {
  return (
    <div className="bg-white rounded-card shadow-card px-8 py-10">
      <div className="flex items-center gap-2.5 mb-6">
        <Loader2 size={18} className="text-[var(--accent)] animate-spin" />
        <span className="text-[15px] font-semibold text-[var(--ink)]">{title}</span>
      </div>
      <div className="flex flex-col gap-2.5 max-w-md">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {i < step ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              : i === step ? <Loader2 size={16} className="text-[var(--accent)] animate-spin shrink-0" />
                : <div className="w-4 h-4 rounded-full border-2 border-[var(--line-strong)] shrink-0" />}
            <span className={`text-[13px] ${i <= step ? 'text-[var(--ink)]' : 'text-[var(--muted-2)]'}`}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BlueprintPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, blueprints, strategies, saveBlueprint, saveStudentDraft } = useApp();
  const student = students.find(s => s.id === studentId);
  const blueprint = blueprints[studentId] ?? null;
  const positioning = student?.positioning;
  const confirmed = isPositioningConfirmed(positioning);
  const hasStrategy = !!strategies[studentId]?.v2?.assessment;

  const [busy, setBusy] = useState<null | 'positioning' | 'blueprint'>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [revisiting, setRevisiting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-open the print dialog when arrived at via ?print=1 (from Documents).
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('print') === '1' && blueprint && confirmed) {
      const t = setTimeout(() => window.print(), 700);
      return () => clearTimeout(t);
    }
  }, [searchParams, blueprint, confirmed]);

  async function run(kind: 'positioning' | 'blueprint', steps: string[], fn: () => Promise<void>) {
    if (!student || busy) return;
    setBusy(kind); setError(null); setStep(0);
    const timer = setInterval(() => setStep(p => Math.min(p + 1, steps.length - 1)), 8000);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Generation failed.'); }
    finally { clearInterval(timer); setBusy(null); }
  }

  const generatePositioning = () => run('positioning', POS_STEPS, async () => {
    const raw = await streamJson('/api/positioning', { studentId }) as Partial<PositioningState>;
    if (!raw.hypotheses?.length) throw new Error('No hypotheses were returned. Please try again.');
    const next: PositioningState = {
      generatedAt: raw.generatedAt ?? new Date().toISOString(),
      hypotheses: raw.hypotheses,
      validations: [],
      confirmed: [],
    };
    const ok = student ? await saveStudentDraft({ ...student, positioning: next }) : false;
    if (!ok) throw new Error('The hypotheses were generated but could not be saved — your session may have expired. Refresh the page, sign in again, and retry.');
    setRevisiting(false);
  });

  const generateBlueprint = () => run('blueprint', LOADING_STEPS, async () => {
    const raw = await streamJson('/api/blueprint', { studentId });
    if (!isBlueprint(raw)) throw new Error('The AI returned an incomplete Blueprint. Please regenerate.');
    const ok = await saveBlueprint(studentId, raw);
    if (!ok) setError('Generated and saved on the server, but this window could not sync. Reload to pick it up.');
  });

  async function confirmIdentity(dirs: ConfirmedDirection[], validations: HypothesisValidation[]) {
    if (!student || !positioning) return;
    setSaving(true); setError(null);
    const ok = await saveStudentDraft({ ...student, positioning: { ...positioning, confirmed: dirs, validations } });
    setSaving(false);
    if (!ok) {
      setError('Could not save your confirmed identity — your session may have expired. Refresh the page, sign in again, and confirm once more.');
      return;
    }
    setRevisiting(false);
  }

  if (!student) return <div className="animate-fade-in text-[var(--muted)]">Student not found.</div>;

  const firstName = student.name.split(' ')[0];
  const hyp = (id: string) => positioning?.hypotheses.find(h => h.id === id);

  const headerActions = confirmed && !revisiting && blueprint && !busy ? (
    <div className="flex items-center gap-2 no-print">
      <GhostButton onClick={() => window.print()}><Printer size={14} /> Print / Save PDF</GhostButton>
      <GhostButton onClick={generateBlueprint}><RefreshCw size={14} /> Regenerate</GhostButton>
    </div>
  ) : undefined;

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <PageHeader
        title="Blueprint"
        sub={`Designing the person before the application — starting from who ${firstName} is.`}
        actions={headerActions}
      />

      {error && (
        <div className="mb-4">
          <AlertCard tone="critical" title="Generation failed" body={error} />
        </div>
      )}

      {busy === 'positioning' ? (
        <LoadingCard title="Proposing positioning hypotheses…" steps={POS_STEPS} step={step} />
      ) : busy === 'blueprint' ? (
        <LoadingCard title="Designing the Blueprint…" steps={LOADING_STEPS} step={step} />
      ) : !positioning?.hypotheses?.length ? (
        /* Stage 1 empty — discover positioning */
        <EmptyState
          icon={<Compass size={24} />}
          title={`Discover ${firstName}'s positioning`}
          body={
            <>
              Before any conclusion, the system proposes a few evidence-backed readings of who {firstName} might be. {firstName} decides which feels right — the Blueprint is built from that, never imposed.
              <span className="block text-[12.5px] text-[var(--muted-2)] mt-2">
                {hasStrategy ? 'Reuses the assessment from the generated strategy.' : 'Runs a profile assessment first.'}
              </span>
            </>
          }
          action={<PrimaryButton onClick={generatePositioning}><Sparkles size={16} /> Propose positioning hypotheses</PrimaryButton>}
        />
      ) : !confirmed || revisiting ? (
        /* Stage 1 — validate + converge */
        <PositioningPanel
          hypotheses={positioning.hypotheses}
          initialConfirmed={positioning.confirmed}
          onConfirm={confirmIdentity}
          onRegenerate={generatePositioning}
          saving={saving}
        />
      ) : (
        /* Confirmed — show Seed summary + Blueprint */
        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-emerald-200 bg-emerald-50 px-6 py-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={16} />
                <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Confirmed identity · Blueprint Seed</span>
              </div>
              <button onClick={() => setRevisiting(true)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--accent)] hover:underline">
                <Pencil size={12} /> Revisit
              </button>
            </div>
            <div className="flex flex-col gap-2 mt-3">
              {positioning.confirmed.slice().sort((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0)).map(c => {
                const h = hyp(c.hypothesisId);
                if (!h) return null;
                const roleLabel = c.role === 'primary' ? 'Primary' : c.role === 'secondary' ? 'Secondary' : 'Explore';
                return (
                  <div key={c.hypothesisId} className="flex items-baseline gap-2.5 flex-wrap">
                    <span className={`text-[10.5px] font-bold uppercase tracking-[0.06em] w-16 shrink-0 ${c.role === 'primary' ? 'text-emerald-700' : 'text-[var(--muted)]'}`}>{roleLabel}</span>
                    <span className="text-[14.5px] font-semibold text-[var(--ink)]">{h.label}</span>
                    <span className="text-[12px] text-[var(--muted)]">· {HYPOTHESIS_KIND_META[h.kind].label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {blueprint ? (
            <BlueprintDocument blueprint={blueprint} />
          ) : (
            <EmptyState
              icon={<ScrollText size={24} />}
              title="Build the full Blueprint"
              body="Now that the identity is confirmed, generate the six-volume strategy book — every claim carries an evidence label, nothing is invented."
              action={<PrimaryButton onClick={generateBlueprint}><Sparkles size={16} /> Generate Blueprint</PrimaryButton>}
            />
          )}
        </div>
      )}
    </div>
  );
}
