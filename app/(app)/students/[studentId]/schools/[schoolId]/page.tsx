'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Minus,
  ShieldCheck, TriangleAlert, CircleHelp, Database, Eye,
  CalendarDays, Package, Target, Scale,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SCHOOLS } from '@/lib/schools';
import { getSchoolFacts } from '@/lib/admissions/schoolFacts';
import {
  DATA_CYCLE, ENGINE_VERSION, evaluateSchool, extractStudentNumbers,
  matchesRegionOrState, type SchoolEvaluation,
} from '@/lib/admissions/engine';
import { TIER_META, TIER_ORDER, tierIndex, type Tier } from '@/lib/admissions/definitions';
import type { Fact } from '@/lib/admissions/definitions';
import { BUCKET_BADGE } from '@/components/assessment/ui';
import { IntelligenceCenter } from '@/components/intelligence/IntelligenceCenter';

/* ── Shared chips ─────────────────────────────────────────── */

const CONF_CHIP: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-red-50 text-red-600 border-red-200',
};

function ConfDot({ level }: { level: string }) {
  const color = level === 'high' ? 'bg-emerald-500' : level === 'medium' ? 'bg-amber-400' : 'bg-red-400';
  return <span className={`inline-flex items-center gap-1 text-[11px] font-medium capitalize text-[var(--ink-soft)]`}><span className={`w-2 h-2 rounded-full ${color}`} />{level}</span>;
}

const SOURCE_LABEL: Record<string, string> = {
  official_program: 'Official (program)',
  cds_official: 'Official (CDS)',
  state_data: 'State data',
  hs_history: 'HS history',
  third_party: 'Third-party',
  expert_estimate: 'Judgment',
};

const BASIS_LABEL: Record<string, string> = {
  official_fact: 'Official data',
  derived_stat: 'Derived stat',
  llm_assessment: 'AI profile read',
  policy_rule: 'Calibration rule',
  expert_estimate: 'Judgment',
};

const UNKNOWN_LABELS: Record<string, string> = {
  hooks_not_modeled: 'Legacy, athlete, and development hooks are not modeled — no advantage is assumed for this applicant.',
  major_specific_data_unavailable: 'No program-level admission data for this major at this school — the campus-wide rate is used as a prior.',
  major_specific_rate_unavailable: 'This program is known to be gated but publishes no admit rate — competitiveness is applied qualitatively.',
  financial_need_unstated: 'Need-based aid status is not set in the profile — affordability is unconfirmed.',
};


/* ── Tier track (honest waterfall: whole steps on a 5-tier scale) ── */

function TierTrack({ from, to }: { from: Tier; to: Tier }) {
  const fromIdx = tierIndex(from);
  const toIdx = tierIndex(to);
  return (
    <div className="flex gap-0.5">
      {TIER_ORDER.map((t, i) => {
        const isTo = i === toIdx;
        const isFrom = i === fromIdx && fromIdx !== toIdx;
        const inPath = (i > Math.min(fromIdx, toIdx) && i < Math.max(fromIdx, toIdx));
        return (
          <div
            key={t}
            title={TIER_META[t].label}
            className={`h-2.5 w-7 rounded-sm ${
              isTo ? 'bg-[var(--accent)]'
              : isFrom ? 'bg-slate-300'
              : inPath ? 'bg-[var(--accent-100)]'
              : 'bg-slate-100'
            }`}
          />
        );
      })}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default function SchoolDetailPage() {
  const params = useParams();
  const { students, strategies } = useApp();
  const studentId = params.studentId as string;
  const schoolId = params.schoolId as string;

  const student = students.find(s => s.id === studentId);
  const school = SCHOOLS.find(s => s.id === schoolId);
  const v2 = strategies[studentId]?.v2 ?? null;
  const facts = getSchoolFacts(schoolId);

  // Prefer the stored evaluation (what the report was built from); recompute
  // deterministically for schools that weren't on the student's list.
  const { evaluation, recomputed } = useMemo((): { evaluation: SchoolEvaluation | null; recomputed: boolean } => {
    if (!student || !school) return { evaluation: null, recomputed: false };
    const stored = v2?.evaluations?.find(e => e.schoolId === schoolId);
    if (stored) return { evaluation: stored, recomputed: false };
    if (!v2?.assessment) return { evaluation: null, recomputed: false };
    return {
      evaluation: evaluateSchool(student, extractStudentNumbers(student), v2.assessment, school),
      recomputed: true,
    };
  }, [student, school, v2, schoolId]);

  if (!student || !school) return <div className="text-[var(--muted)]">School or student not found.</div>;

  if (!evaluation) {
    return (
      <div className="animate-fade-in max-w-[1080px] mx-auto">
        <BackLink studentId={studentId} />
        <div className="bg-white rounded-card shadow-card p-16 text-center">
          <h3 className="text-[16px] font-semibold text-[var(--ink)] mb-2">{school.name}</h3>
          <p className="text-[13px] text-[var(--muted)] max-w-md mx-auto">
            No strategy has been generated for {student.name} yet — the per-school evaluation (tier, adjustment trace, confidence) is produced by the strategy engine.
          </p>
          <Link href={`/students/${studentId}/strategy`} className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded text-white text-[13.5px] font-medium" style={{ background: 'var(--accent)' }}>
            Generate a strategy <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const positives = evaluation.trace.filter(t => t.stepDelta > 0);
  const negatives = evaluation.trace.filter(t => t.stepDelta < 0);
  const unknowns = evaluation.unknowns ?? [];
  // A recomputed evaluation is produced by the LIVE engine — label it with
  // the live version, not the version stamped on the stored payload.
  const dataCycle = recomputed ? DATA_CYCLE : (v2?.dataCycle ?? DATA_CYCLE);
  const engineVersion = recomputed ? `${ENGINE_VERSION} (live)` : (v2?.engineVersion ?? ENGINE_VERSION);

  // Running tier per trace row for the waterfall (pure cumulative fold)
  const clampIdx = (n: number) => Math.max(0, Math.min(4, n));
  const cumulativeIdx = (upTo: number) =>
    clampIdx(evaluation.trace.slice(0, upTo).reduce((acc, r) => clampIdx(acc + r.stepDelta), tierIndex(evaluation.baseTier)));
  const rows = evaluation.trace.map((t, i) => ({
    ...t,
    from: TIER_ORDER[cumulativeIdx(i)],
    to: TIER_ORDER[cumulativeIdx(i + 1)],
  }));

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <BackLink studentId={studentId} />

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--ink)]">
            {school.name} <span className="text-[var(--muted)] font-normal">· {student.major}</span>
          </h1>
          <p className="text-[var(--muted)] mt-1">{school.city}, {school.state} · #{school.ranking} · {school.type}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/students/${studentId}/essays`} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--line-strong)] bg-white text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors">
            Essays
          </Link>
          <Link href={`/students/${studentId}/strategy`} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[13.5px] font-medium" style={{ background: 'var(--accent)' }}>
            View Strategy <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {recomputed && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-[12.5px] px-4 py-2.5">
          This school is not on {student.name}&apos;s list — the evaluation below was computed on demand from the saved profile assessment with the same deterministic rules.
        </div>
      )}

      {/* Stat strip */}
      <div className="mb-4 bg-white rounded-card shadow-card px-5 py-4 grid grid-cols-2 md:grid-cols-6 gap-4">
        <Stat icon={<Target size={13} />} label="Tier">
          <span className={`inline-flex text-[12px] font-bold px-2 py-0.5 rounded-pill border ${BUCKET_BADGE[evaluation.uiBucket]}`}>{evaluation.tierLabel}</span>
        </Stat>
        <Stat icon={<Scale size={13} />} label="Likelihood Band">
          <span className="text-[15px] font-bold text-[var(--ink)]">{evaluation.band.min}–{evaluation.band.max}%</span>
        </Stat>
        <Stat icon={<Database size={13} />} label="School Data Confidence"><ConfDot level={evaluation.dataConfidence} /></Stat>
        <Stat icon={<Eye size={13} />} label="Profile Confidence"><ConfDot level={evaluation.assessmentConfidence} /></Stat>
        <Stat icon={<CalendarDays size={13} />} label="Application Season"><span className="text-[13px] font-semibold text-[var(--ink)]">{dataCycle}</span></Stat>
        <Stat icon={<Package size={13} />} label="Model Version"><span className="text-[13px] font-semibold text-[var(--ink)]">v{engineVersion}</span></Stat>
      </div>

      {/* Fit & application intelligence (folded in from the Research page) */}
      <div className="mb-2 flex items-center gap-2">
        <Eye size={13} className="text-[var(--accent)]" />
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--muted)]">Fit &amp; Application Intelligence</h2>
      </div>
      <div className="mb-6">
        <IntelligenceCenter student={student} school={school} v2={v2} studentId={studentId} />
      </div>

      {/* How the tier was computed — the deterministic engine audit */}
      <div className="mb-2 flex items-center gap-2">
        <Scale size={13} className="text-[var(--accent)]" />
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--muted)]">Engine Audit — how the tier was computed</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ① Adjustment trace */}
        <section className="lg:col-span-3 bg-white rounded-card shadow-card">
          <SectionHead num="01" title="Adjustment Trace" sub="every factor that moved this tier, in order" />
          <div className="px-6 py-4 flex flex-col">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 pb-2 border-b border-[var(--line)] text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              <span>Factor</span><span>Tier Position</span><span>Basis · Confidence</span>
            </div>
            {rows.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-start py-3 border-b border-[var(--line)] last:border-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
                    {t.stepDelta > 0 ? <ArrowUp size={13} className="text-emerald-500 shrink-0" />
                      : t.stepDelta < 0 ? <ArrowDown size={13} className="text-red-500 shrink-0" />
                      : <Minus size={13} className="text-slate-300 shrink-0" />}
                    {t.label}
                  </div>
                  <p className="text-[12px] text-[var(--muted)] leading-relaxed mt-0.5 pl-[19px]">{t.rationale}</p>
                </div>
                <div className="flex flex-col items-end gap-1 pt-0.5">
                  <TierTrack from={t.from} to={t.to} />
                  <span className="text-[10.5px] text-[var(--muted)]">{TIER_META[t.to].label}{t.stepDelta !== 0 ? ` (${t.stepDelta > 0 ? '+' : ''}${t.stepDelta})` : ''}</span>
                </div>
                <div className="flex flex-col items-end gap-1 pt-0.5">
                  <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600">{BASIS_LABEL[t.basis] ?? t.basis}</span>
                  <ConfDot level={t.confidence} />
                </div>
              </div>
            ))}
            <div className="mt-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-4 py-3 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-[var(--ink)]">Final: {evaluation.tierLabel} · {evaluation.band.min}–{evaluation.band.max}%</span>
              <span className="text-[11px] text-[var(--muted)]">{evaluation.ceilingReason}</span>
            </div>
          </div>
        </section>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* ② Why this tier */}
          <section className="bg-white rounded-card shadow-card">
            <SectionHead num="02" title="Why This Tier" />
            <div className="px-6 py-4 flex flex-col gap-3">
              <WhyBlock icon={<ShieldCheck size={14} className="text-emerald-600" />} title="Strengths"
                items={positives.map(t => t.label)} empty="No factor moved this school upward." />
              <WhyBlock icon={<TriangleAlert size={14} className="text-amber-500" />} title="Constraints"
                items={negatives.map(t => t.label)} empty="No factor moved this school downward." />
              <WhyBlock icon={<CircleHelp size={14} className="text-slate-400" />} title="Unknowns"
                items={unknowns.map(u => UNKNOWN_LABELS[u] ?? u)} empty="No declared unknowns." />
            </div>
          </section>

          {/* ③ Policy & data */}
          <section className="bg-white rounded-card shadow-card">
            <SectionHead num="03" title="Policy & Data" sub={`what we know about ${school.short}, with provenance`} />
            <div className="px-6 py-4 flex flex-col">
              <PolicyRow label="Testing" fact={facts?.testPolicy} format={v => ({ required: 'Required', optional: 'Optional', blind: 'Test-blind', flexible: 'Test-flexible' })[v] ?? v} />
              <PolicyRow label="Early rounds" fact={facts?.earlyRounds} format={v => ({ ED: 'ED', ED1_ED2: 'ED I + ED II', EA: 'EA', REA: 'REA', EA_ED: 'EA + ED', rolling: 'Rolling', none: 'None' })[v] ?? v} />
              <PolicyRow label="ED strategic value" fact={facts?.edStrategicValue} format={v => v.replace(/_/g, ' ')} />
              <PolicyRow label={`${student.major.split('/')[0].trim()} gating`} fact={facts?.csMajor} format={v => `${v.competitiveness}${v.directAdmit ? ' · direct admit' : ''} · transfer ${v.internalTransfer.replace('_', ' ')}${v.admitRatePct !== undefined ? ` · ~${v.admitRatePct}%` : ''}`} />
              <PolicyRow label="Intl need-blind" fact={facts?.intlNeedBlind} format={v => (v ? 'Yes' : 'No (need-aware)')} />
              <PolicyRow label="Intl aid available" fact={facts?.intlAidAvailable} format={v => (v ? 'Yes' : 'No')} />
              <PolicyRow label="In-state advantage" fact={facts?.inStateAdvantage} format={v => v} />
              {!facts && <p className="text-[12px] text-[var(--muted)] py-2">No policy facts recorded for this school.</p>}
            </div>
          </section>

          {/* ④ Preference fit — qualitative, no invented scores */}
          <section className="bg-white rounded-card shadow-card">
            <SectionHead num="04" title="Preference Fit" sub="stated preferences only — not a scored metric" />
            <div className="px-6 py-4 flex flex-col gap-2">
              <FitRow label="Major offered" ok={school.majors.some(m => m.toLowerCase().includes(student.major.toLowerCase().split('/')[0].trim().toLowerCase()) || student.major.toLowerCase().includes(m.toLowerCase()))} detail={school.majors.slice(0, 4).join(', ')} />
              <FitRow label="Region / state" ok={student.preferredRegions?.length ? student.preferredRegions.some(r => matchesRegionOrState(r, school)) : null} detail={`${school.region} · ${school.state}`} />
              <FitRow label="Setting" ok={student.preferredSettings?.length ? student.preferredSettings.includes(school.setting) : null} detail={school.setting} />
              <FitRow label="Size" ok={student.preferredSchoolSizes?.length ? student.preferredSchoolSizes.includes(school.size) : null} detail={school.size} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Section pieces ───────────────────────────────────────── */

function BackLink({ studentId }: { studentId: string }) {
  return (
    <Link href={`/students/${studentId}/strategy`} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-3">
      <ArrowLeft size={13} /> Back to strategy
    </Link>
  );
}

function Stat({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1.5">{icon}{label}</div>
      {children}
    </div>
  );
}

function SectionHead({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <div className="px-6 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
        {sub && <p className="text-[11.5px] text-[var(--muted)] mt-0.5">{sub}</p>}
      </div>
      <span className="text-[11px] font-bold text-[var(--muted)] tabular-nums">{num}</span>
    </div>
  );
}

function WhyBlock({ icon, title, items, empty }: { icon: React.ReactNode; title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--ink-soft)] mb-1.5">{icon}{title}</div>
      {items.length ? (
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => <li key={i} className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">· {item}</li>)}
        </ul>
      ) : <p className="text-[12px] text-[var(--muted)]">{empty}</p>}
    </div>
  );
}

function PolicyRow<T>({ label, fact, format }: { label: string; fact: Fact<T> | undefined; format: (v: T) => string }) {
  if (!fact) return null;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-3 py-2.5 border-b border-[var(--line)] last:border-0 items-start">
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-[var(--ink)]">
          {label}: <span className="font-medium text-[var(--ink-soft)] capitalize">{format(fact.value)}</span>
        </div>
        {fact.meta.note && <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-0.5">{fact.meta.note}</p>}
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${fact.meta.isEstimated ? CONF_CHIP.low : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
          {SOURCE_LABEL[fact.meta.sourceType] ?? fact.meta.sourceType}{fact.meta.isEstimated ? ' · est.' : ''}
        </span>
        <span className="text-[10px] text-[var(--muted)]">{fact.meta.admissionCycle} · <ConfDot level={fact.meta.confidence} /></span>
      </div>
    </div>
  );
}

function FitRow({ label, ok, detail }: { label: string; ok: boolean | null; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] font-medium text-[var(--ink)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] text-[var(--muted)]">{detail}</span>
        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-pill border ${
          ok === null ? 'bg-slate-50 border-slate-200 text-slate-500'
          : ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          {ok === null ? 'No preference' : ok ? 'Match' : 'Outside preference'}
        </span>
      </div>
    </div>
  );
}
