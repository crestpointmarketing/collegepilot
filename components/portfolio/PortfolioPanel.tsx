'use client';

/**
 * Portfolio analysis panel for the Schools page — renders the student's own
 * list from the stored v2 evaluations: coverage stats, likelihood/selectivity
 * scatter, structural risks, per-school table with the acceptability toggle,
 * and engine suggestions kept strictly separate.
 */

import Link from 'next/link';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { Shield, ShieldAlert, Target, Cpu, MapPin, ArrowRight, Check, X } from 'lucide-react';
import { SCHOOLS } from '@/lib/schools';
import { getSchoolFacts } from '@/lib/admissions/schoolFacts';
import { isInternationalApplicant } from '@/lib/admissions/engine';
import {
  BUCKET_BADGE, CHART_BUCKET_COLOR, CONF_CHIP, SHUTOUT_STYLE, derivePortfolioAlerts,
} from '@/components/assessment/ui';
import type { Student, StrategyV2 } from '@/types';

type V2Eval = NonNullable<StrategyV2['evaluations']>[number];

function aidSignal(student: Student, schoolId: string): { label: string; tone: 'good' | 'warn' | 'muted' } {
  const facts = getSchoolFacts(schoolId);
  if (isInternationalApplicant(student) && student.needBasedAid === 'Yes') {
    if (facts?.intlAidAvailable && !facts.intlAidAvailable.value) return { label: 'No intl aid', tone: 'warn' };
    if (facts?.intlNeedBlind?.value) return { label: 'Need-blind', tone: 'good' };
    return { label: 'Need-aware', tone: 'warn' };
  }
  if (student.needBasedAid === 'No') return { label: 'Aid not needed', tone: 'good' };
  return { label: 'Unconfirmed', tone: 'muted' };
}

export function PortfolioPanel({
  student, v2, onToggleAttend, saving,
}: {
  student: Student;
  v2: StrategyV2;
  onToggleAttend: (schoolId: string) => void;
  saving: boolean;
}) {
  const evals = v2.evaluations ?? [];
  const suggestions = v2.suggestions ?? [];
  const notAttendIds = student.notAttendIds ?? [];
  const portfolio = v2.portfolio;
  const alerts = derivePortfolioAlerts(v2, student.id, notAttendIds);
  const schoolsById = new Map(SCHOOLS.map(s => [s.id, s]));

  const trueSafeties = evals.filter(e => e.tierLabel === 'Very Likely' && !notAttendIds.includes(e.schoolId)).length;
  const gatedShare = evals.length
    ? Math.round((evals.filter(e => e.baseRateUsed.scope === 'major' || e.flags.includes('major_locked')).length / evals.length) * 100)
    : 0;
  const regionCounts = new Map<string, number>();
  for (const e of evals) {
    const region = schoolsById.get(e.schoolId)?.region ?? '?';
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
  }
  const topRegion = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topRegionShare = topRegion && evals.length ? Math.round((topRegion[1] / evals.length) * 100) : 0;

  const scatterData = evals.map(e => ({
    name: e.short,
    x: Math.round((e.band.min + e.band.max) / 2),
    y: schoolsById.get(e.schoolId)?.ranking ?? 60,
    bucket: e.uiBucket,
  }));

  return (
    <div className="mb-6 flex flex-col gap-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<Shield size={13} />} label="True Safeties" value={String(trueSafeties)}
          hint="Very Likely tier + student would attend + affordability confirmed" warn={trueSafeties === 0} />
        <StatCard icon={<Cpu size={13} />} label="Gated-Major Share" value={`${gatedShare}%`}
          hint="Schools where admission runs through capped CS/engineering" warn={gatedShare > 60} />
        <StatCard icon={<MapPin size={13} />} label="Region Concentration" value={topRegion ? `${topRegionShare}% ${topRegion[0]}` : '—'}
          hint="Largest single-region share of the list" warn={topRegionShare > 70} />
        <StatCard icon={<Target size={13} />} label="P(≥1 admit)" value={`${portfolio.pAtLeastOne.lowerPct}–${portfolio.pAtLeastOne.upperPct}%`}
          hint={portfolio.pAtLeastOne.note} />
        <div className={`rounded-card border shadow-card px-3.5 py-3 flex flex-col justify-center ${SHUTOUT_STYLE[portfolio.shutoutRisk]}`}>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest mb-0.5"><ShieldAlert size={12} /> Shutout Risk</div>
          <div className="text-[16px] font-bold capitalize">{portfolio.shutoutRisk}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Scatter */}
        <section className="lg:col-span-3 bg-white rounded-card shadow-card px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[14px] font-semibold text-[var(--ink)]">Likelihood vs Selectivity</h2>
            <div className="flex items-center gap-3 text-[10.5px] text-[var(--muted)]">
              {Object.entries(CHART_BUCKET_COLOR).map(([k, c]) => (
                <span key={k} className="flex items-center gap-1 capitalize"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{k}</span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
              <XAxis type="number" dataKey="x" name="Band midpoint" unit="%" domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                label={{ value: 'Likelihood band midpoint', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="number" dataKey="y" name="US ranking" reversed domain={[0, 60]}
                tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={34}
                label={{ value: 'Ranking', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }} />
              <ZAxis range={[90, 90]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(value, name) => [name === 'US ranking' ? `#${value}` : `${value}%`, name]} />
              <Scatter data={scatterData}>
                {scatterData.map((d, i) => <Cell key={i} fill={CHART_BUCKET_COLOR[d.bucket]} fillOpacity={0.85} />)}
                <LabelList dataKey="name" position="top" style={{ fontSize: 9.5, fill: '#475569' }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-[10.5px] text-[var(--muted)] mt-1">Band midpoints shown for placement only — each school&apos;s honest range lives on its detail page.</p>
        </section>

        {/* Structural risks */}
        <section className="lg:col-span-2 bg-white rounded-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--line)] flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-red-500" />
            <h2 className="text-[14px] font-semibold text-[var(--ink)]">Structural Risks</h2>
            <span className="ml-auto text-[11px] text-[var(--muted)]">{alerts.length}</span>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2 max-h-[280px] overflow-y-auto">
            {alerts.length === 0 && <p className="text-[12px] text-[var(--muted)] py-1">No structural risks flagged.</p>}
            {alerts.map((a, i) => (
              <div key={i} className={`rounded-lg border px-3 py-2.5 ${a.severity === 'red' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
                <div className={`text-[12px] font-bold ${a.severity === 'red' ? 'text-red-600' : 'text-amber-700'}`}>{a.title}</div>
                <p className="text-[11.5px] text-[var(--ink-soft)] leading-relaxed mt-0.5">{a.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Selected schools table */}
      <section className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--line)] flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[var(--ink)]">Selected Schools ({evals.length})</h2>
          <span className="text-[11px] text-[var(--muted)]">“Would attend” is the acceptability test — a safety the student wouldn&apos;t enroll at doesn&apos;t count</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)] border-b border-[var(--line)]">
                <th className="px-5 py-2.5">School</th>
                <th className="px-3 py-2.5">Tier</th>
                <th className="px-3 py-2.5">Band</th>
                <th className="px-3 py-2.5">Data</th>
                <th className="px-3 py-2.5">Profile</th>
                <th className="px-3 py-2.5">Aid</th>
                <th className="px-3 py-2.5">Would attend</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {evals.map(ev => (
                <SchoolRow key={ev.schoolId} ev={ev} student={student}
                  notAttend={notAttendIds.includes(ev.schoolId)}
                  onToggleAttend={onToggleAttend} saving={saving} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Suggestions — never mixed into the student's list */}
      {suggestions.length > 0 && (
        <section className="rounded-card border border-dashed border-[var(--accent-100)] bg-[var(--accent-50)]/40 px-5 py-4">
          <h2 className="text-[13px] font-semibold text-[var(--ink)] mb-0.5">Suggested Additions — not on the student&apos;s list</h2>
          <p className="text-[11.5px] text-[var(--muted)] mb-3">Engine proposals that patch coverage gaps. Add them via the Profile school picker after discussing with the family.</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(ev => (
              <Link key={ev.schoolId} href={`/students/${student.id}/schools/${ev.schoolId}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 hover:border-[var(--accent)] transition-colors">
                <span className="text-[12.5px] font-semibold text-[var(--ink)]">{ev.short}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-pill border ${BUCKET_BADGE[ev.uiBucket]}`}>{ev.tierLabel} · {ev.band.min}–{ev.band.max}%</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────── */

function StatCard({ icon, label, value, hint, warn = false }: { icon: React.ReactNode; label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className={`rounded-card border shadow-card px-3.5 py-3 ${warn ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-[var(--line)]'}`} title={hint}>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-0.5">{icon}{label}</div>
      <div className={`text-[16px] font-bold ${warn ? 'text-amber-700' : 'text-[var(--ink)]'}`}>{value}</div>
    </div>
  );
}

function SchoolRow({ ev, student, notAttend, onToggleAttend, saving }: {
  ev: V2Eval; student: Student; notAttend: boolean;
  onToggleAttend: (schoolId: string) => void; saving: boolean;
}) {
  const aid = aidSignal(student, ev.schoolId);
  const aidCls = aid.tone === 'good' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : aid.tone === 'warn' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-slate-500 bg-slate-50 border-slate-200';
  return (
    <tr className={`border-b border-[var(--line)] last:border-0 ${notAttend ? 'opacity-60' : ''}`}>
      <td className="px-5 py-2.5">
        <Link href={`/students/${student.id}/schools/${ev.schoolId}`} className="text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--accent)] hover:underline">
          {ev.short}
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-pill border ${BUCKET_BADGE[ev.uiBucket]}`}>{ev.tierLabel}</span>
      </td>
      <td className="px-3 py-2.5 text-[12px] font-semibold text-[var(--ink)]">{ev.band.min}–{ev.band.max}%</td>
      <td className="px-3 py-2.5"><span className={`text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded border ${CONF_CHIP[ev.dataConfidence]}`}>{ev.dataConfidence}</span></td>
      <td className="px-3 py-2.5"><span className={`text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded border ${CONF_CHIP[ev.assessmentConfidence]}`}>{ev.assessmentConfidence}</span></td>
      <td className="px-3 py-2.5"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${aidCls}`}>{aid.label}</span></td>
      <td className="px-3 py-2.5">
        <button
          onClick={() => onToggleAttend(ev.schoolId)}
          disabled={saving}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-pill border transition-colors disabled:opacity-50 ${
            notAttend
              ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          }`}
          title="Acceptability test: would the student actually enroll here if it were the only admit?"
        >
          {notAttend ? <><X size={11} /> Would not attend</> : <><Check size={11} /> Yes</>}
        </button>
      </td>
      <td className="px-3 py-2.5 text-right">
        <Link href={`/students/${student.id}/schools/${ev.schoolId}`} className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: 'var(--accent)' }}>
          Why <ArrowRight size={11} />
        </Link>
      </td>
    </tr>
  );
}

