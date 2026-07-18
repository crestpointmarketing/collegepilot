'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Sparkles, ArrowRight, ShieldAlert, TriangleAlert, Trophy, Shield,
  Target, CalendarDays, ListTodo, GraduationCap,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  DIMENSION_GROUPS, DIMENSION_LABELS, SHUTOUT_STYLE, TierBar, computeReadiness, derivePortfolioAlerts,
} from '@/components/assessment/ui';
import type { Strategy, StrategyV2 } from '@/types';

const TIER_SEGMENTS: { key: string; label: string; range: string; color: string }[] = [
  { key: 'Unlikely', label: 'Unlikely', range: '2–8%', color: '#ef4444' },
  { key: 'Reach', label: 'Reach', range: '8–20%', color: '#f97316' },
  { key: 'Possible', label: 'Possible', range: '20–45%', color: '#f59e0b' },
  { key: 'Likely', label: 'Likely', range: '45–70%', color: '#14b8a6' },
  { key: 'Very Likely', label: 'Very Likely', range: '70–92%', color: '#0d9488' },
];

export default function OverviewPage() {
  const params = useParams();
  const { students, strategies } = useApp();
  const studentId = params.studentId as string;
  const student = students.find(s => s.id === studentId);
  const strategy: Strategy | null = strategies[studentId] ?? null;
  const v2 = strategy?.v2 ?? null;

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  if (!strategy || !v2) {
    return (
      <div className="animate-fade-in">
        <Head name={student.name} school={student.school} v2={null} />
        <div className="bg-white rounded-card shadow-card p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-50)] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="text-[16px] font-semibold text-[var(--ink)] mb-2">No strategy yet</h3>
          <p className="text-[13px] text-[var(--muted)] mb-6 max-w-sm mx-auto">
            The overview brings together the assessment, school portfolio, risks, and plan — generate a strategy to populate it.
          </p>
          <Link href={`/students/${studentId}/strategy`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium" style={{ background: 'var(--accent)' }}>
            Generate a strategy <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const dims = v2.assessment.dimensions;
  const readiness = computeReadiness(dims);
  const evals = v2.evaluations ?? [];
  const portfolio = v2.portfolio;

  const tierCounts = TIER_SEGMENTS.map(seg => ({
    ...seg,
    n: evals.filter(e => e.tierLabel === seg.label).length,
  }));
  const notAttendIds = student.notAttendIds ?? [];
  const trueSafeties = evals.filter(e => e.tierLabel === 'Very Likely' && !notAttendIds.includes(e.schoolId)).length;
  const alerts = derivePortfolioAlerts(v2, studentId, notAttendIds);

  return (
    <div className="animate-fade-in">
      <Head name={student.name} school={student.school} v2={v2} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ① Student profile */}
            <Card title="Student Profile" num="01" href={`/students/${studentId}/assessment`} linkLabel="Full assessment">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] text-[var(--ink-soft)]">{v2.assessment.spike.has_spike ? v2.assessment.spike.domain : 'No clear spike identified'}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-[var(--accent-50)]" style={{ color: 'var(--accent)' }}>Evidence {readiness.pct}%</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {DIMENSION_GROUPS.flatMap(g => g.keys.map(key => ({ key, color: g.color }))).map(({ key, color }) => {
                  const d = dims[key];
                  if (!d) return null;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-[var(--ink-soft)] truncate">{DIMENSION_LABELS[key]}</span>
                      <TierBar tier={d.tier} color={color} />
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ② Portfolio */}
            <Card title="School Portfolio" num="02" href={`/students/${studentId}/strategy`} linkLabel="Full strategy">
              <div className="flex h-9 rounded-lg overflow-hidden mb-1.5">
                {tierCounts.map(t => (
                  <div key={t.key} title={`${t.label} (${t.range})`} className="flex items-center justify-center text-white text-[13px] font-bold" style={{ background: t.color, flexGrow: Math.max(t.n, 0.35), flexBasis: 0 }}>
                    {t.n > 0 ? t.n : ''}
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9.5px] text-[var(--muted)] mb-4">
                {tierCounts.map(t => <span key={t.key} className="text-center leading-tight">{t.label}<br />({t.range})</span>)}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Stat label="True Safeties" value={String(trueSafeties)} icon={<Shield size={12} />} />
                <Stat label="Schools" value={String(evals.length)} icon={<GraduationCap size={12} />} />
                <Stat label="P(≥1 admit)" value={`${portfolio.pAtLeastOne.lowerPct}–${portfolio.pAtLeastOne.upperPct}%`} icon={<Target size={12} />} />
              </div>
              <div className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-pill border capitalize ${SHUTOUT_STYLE[portfolio.shutoutRisk]}`}>
                <ShieldAlert size={12} /> Shutout risk: {portfolio.shutoutRisk}
              </div>
            </Card>
          </div>

          {/* ④ Executive strategy */}
          <Card title="Executive Strategy" num="03" href={`/students/${studentId}/strategy`} linkLabel="View full strategy">
            <div className="flex flex-col gap-3">
              <ExecRow icon={<Trophy size={15} className="text-emerald-600" />} label="Primary advantage">
                {strategy.positioning.strengths[0] ?? strategy.positioning.type}
              </ExecRow>
              <ExecRow icon={<TriangleAlert size={15} className="text-amber-500" />} label="Primary vulnerability">
                {strategy.positioning.weaknesses[0] ?? '—'}
              </ExecRow>
              <ExecRow icon={<Target size={15} style={{ color: 'var(--accent)' }} />} label="Portfolio read">
                {strategy.meta?.assessment ?? '—'}
              </ExecRow>
            </div>
          </Card>

          {/* ⑥ Timeline strip */}
          <Card title="Timeline" num="04" href={`/students/${studentId}/strategy`} linkLabel="Execution plan">
            <div className="flex items-start gap-0 overflow-x-auto pb-1">
              {strategy.plan.map((p, i) => {
                const critical = /nov|january|jan\b/i.test(p.month);
                return (
                  <div key={i} className="flex-1 min-w-[96px] relative">
                    <div className="flex items-center">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${critical ? 'bg-[var(--accent)] ring-4 ring-[var(--accent-50)]' : 'bg-slate-300'}`} />
                      {i < strategy.plan.length - 1 && <div className="flex-1 h-px bg-[var(--line-strong)]" />}
                    </div>
                    <div className={`mt-2 pr-3 text-[11px] font-bold ${critical ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>{p.month}</div>
                    <p className="pr-3 text-[10.5px] text-[var(--muted)] leading-snug line-clamp-3">{p.tasks.split(/\.\s+/)[0]}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right column: alerts + priorities */}
        <div className="flex flex-col gap-4">
          <section className="rounded-card border border-red-100 bg-red-50/50 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-red-100 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-red-500" />
              <h2 className="text-[14px] font-semibold text-[var(--ink)]">Alerts</h2>
              <span className="ml-auto text-[11px] text-[var(--muted)]">{alerts.length}</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2.5">
              {alerts.length === 0 && <p className="text-[12px] text-[var(--muted)] py-1">No structural risks flagged.</p>}
              {alerts.map((a, i) => (
                <div key={i} className={`rounded-lg border bg-white px-3.5 py-3 ${a.severity === 'red' ? 'border-red-200' : 'border-amber-200'}`}>
                  <div className={`text-[12.5px] font-bold ${a.severity === 'red' ? 'text-red-600' : 'text-amber-700'}`}>{a.title}</div>
                  <p className="text-[11.5px] text-[var(--ink-soft)] leading-relaxed mt-0.5">{a.body}</p>
                  <Link href={a.href} className="inline-flex items-center gap-1 mt-1.5 text-[11.5px] font-semibold" style={{ color: 'var(--accent)' }}>
                    {a.cta} <ArrowRight size={11} />
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* ⑤ Priorities */}
          <section className="bg-white rounded-card shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--line)] flex items-center gap-1.5">
              <ListTodo size={14} className="text-[var(--muted)]" />
              <h2 className="text-[14px] font-semibold text-[var(--ink)]">Strategy Priorities</h2>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2.5">
              {(v2.levers ?? []).slice(0, 3).map((lv, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                    style={{ background: ['#dc2626', '#ea580c', '#f59e0b'][i] ?? 'var(--accent)' }}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-[var(--ink)] leading-snug">{lv.action}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1"><CalendarDays size={10} />{lv.deadline}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--accent-50)] font-semibold" style={{ color: 'var(--accent)' }}>
                        {DIMENSION_LABELS[lv.dimension] ?? lv.dimension.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!(v2.levers ?? []).length && <p className="text-[12px] text-[var(--muted)] py-1">No levers generated.</p>}
              <Link href={`/students/${studentId}/strategy`} className="inline-flex items-center gap-1 text-[11.5px] font-semibold mt-1" style={{ color: 'var(--accent)' }}>
                View all actions <ArrowRight size={11} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────── */

function Head({ name, school, v2 }: { name: string; school: string; v2: StrategyV2 | null }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">Overview</h1>
        <p className="text-[var(--muted)] mt-1">{name} · {school}</p>
      </div>
      {v2 && (
        <div className="flex items-center gap-2 text-[11.5px] text-[var(--muted)]">
          <span className="px-2.5 py-1 rounded-pill bg-white border border-[var(--line)] shadow-card">Season {v2.dataCycle ?? '—'}</span>
          <span className="px-2.5 py-1 rounded-pill bg-white border border-[var(--line)] shadow-card">Engine v{v2.engineVersion ?? '—'}</span>
          <span>Updated {new Date(v2.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      )}
    </div>
  );
}

function Card({ title, num, href, linkLabel, children }: { title: string; num: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--line)] flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-[var(--ink)]">{title}</h2>
        <div className="flex items-center gap-3">
          <Link href={href} className="text-[11.5px] font-semibold" style={{ color: 'var(--accent)' }}>{linkLabel} →</Link>
          <span className="text-[11px] font-bold text-[var(--muted)] tabular-nums">{num}</span>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-0.5">{icon}{label}</div>
      <div className="text-[15px] font-bold text-[var(--ink)]">{value}</div>
    </div>
  );
}

function ExecRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-3.5 py-2.5">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</div>
        <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
