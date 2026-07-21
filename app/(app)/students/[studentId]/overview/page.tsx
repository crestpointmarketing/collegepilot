'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, Download, Star, Compass, Sparkles, ScrollText } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { DIMENSION_LABELS, derivePortfolioAlerts } from '@/components/assessment/ui';
import {
  PageHeader, Card, Chip, StatTile, AlertCard, GhostButton, JourneyStepper, type Tone,
} from '@/components/ui';
import { isPositioningConfirmed } from '@/lib/admissions/journey';
import type { DimensionKey } from '@/lib/admissions/assessment';
import type { Strategy } from '@/types';

/* Dimension tier → qualitative bar. */
const TIER_BAR: Record<string, { pct: number; label: string; color: string }> = {
  exceptional: { pct: 92, label: 'Exceptional', color: 'bg-[#16A34A]' },
  strong:      { pct: 80, label: 'Strong',      color: 'bg-[#16A34A]' },
  solid:       { pct: 62, label: 'Solid',       color: 'bg-[var(--accent)]' },
  developing:  { pct: 45, label: 'Developing',  color: 'bg-[#D97706]' },
  concern:     { pct: 28, label: 'Concern',     color: 'bg-[#DC2626]' },
};

function QualBar({ label, tier }: { label: string; tier: string }) {
  const b = TIER_BAR[tier] ?? TIER_BAR.solid;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-[var(--ink)] w-44 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--bg-deep)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.pct}%` }} />
      </div>
      <span className="text-[12px] text-[var(--muted)] w-24 text-right shrink-0">{b.label}</span>
    </div>
  );
}

export default function OverviewPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, strategies, blueprints } = useApp();
  const student = students.find(s => s.id === studentId);
  const strategy: Strategy | null = strategies[studentId] ?? null;
  const v2 = strategy?.v2 ?? null;
  const blueprint = blueprints[studentId] ?? null;

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  const firstName = student.name.split(' ')[0];
  const positioning = student.positioning;
  const confirmed = isPositioningConfirmed(positioning);

  // Journey progress: Evidence(0) Identity(1) Direction(2) Programs(3) Portfolio(4) Blueprint(5)
  const current = blueprint ? 5 : confirmed ? 2 : positioning?.hypotheses?.length ? 1 : v2 ? 1 : 1;
  const stageLabel = ['Evidence', 'Identity', 'Direction', 'Programs', 'Portfolio', 'Blueprint'][current];

  // Next best action — dynamic from real state.
  const nba = !positioning?.hypotheses?.length
    ? { title: `Discover ${firstName}'s positioning`, body: 'Generate evidence-backed identity hypotheses. Validating them unlocks Academic Direction and school recommendations.', cta: 'Start positioning', href: `/students/${studentId}/blueprint`, icon: <Compass size={14} /> }
    : !confirmed
      ? { title: 'Validate your identity hypotheses', body: `Several positioning hypotheses are ready for ${firstName} to review. Confirming one unlocks the rest of the journey.`, cta: 'Review hypotheses', href: `/students/${studentId}/blueprint`, icon: <Sparkles size={14} /> }
      : !blueprint
        ? { title: 'Generate the full Blueprint', body: 'Identity is confirmed. Build the six-volume strategy book — every claim carries an evidence label.', cta: 'Build Blueprint', href: `/students/${studentId}/blueprint`, icon: <ScrollText size={14} /> }
        : { title: 'Review your strategy & school list', body: 'Your Blueprint is ready. Refine the school portfolio and application rounds.', cta: 'Open strategy', href: `/students/${studentId}/strategy`, icon: <ArrowRight size={14} /> };

  // Snapshot
  const evidenceCount = student.activities.length + student.awards.length + (student.projects?.length ?? 0);
  const confirmedCount = Object.values(student.evidenceStatus ?? {}).filter(s => s === 'confirmed').length;
  const rigor = student.apCount >= 8 ? 'High' : student.apCount >= 4 ? 'Solid' : 'Building';
  const testValue = student.sat ? String(student.sat) : student.act ? String(student.act) : '—';
  const testLabel = student.sat ? 'SAT' : student.act ? 'ACT' : 'Test';

  const dims = v2?.assessment.dimensions;
  const strengths = strategy?.positioning.strengths ?? student.strengths ?? [];
  const alerts = v2 ? derivePortfolioAlerts(v2, studentId, student.notAttendIds ?? []) : [];

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <PageHeader
        title={student.name}
        sub={`${student.grade === 12 ? 'Class of 2026' : `Grade ${student.grade}`} · ${student.major}${blueprint ? ` · Blueprint ${blueprint.draftLabel}` : ''}`}
        actions={
          <>
            <Chip tone="info">{stageLabel} Phase</Chip>
            <Link href={`/students/${studentId}/downloads`}><GhostButton><Download size={13} /> Export</GhostButton></Link>
          </>
        }
      />

      {/* Journey progress */}
      <Card className="mb-5" bodyClassName="px-6 py-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-[13px] font-semibold text-[var(--ink)]">Blueprint Journey Progress</p>
          <span className="text-[12px] text-[var(--muted)]">Step {current + 1} of 6 — {stageLabel}</span>
        </div>
        <JourneyStepper current={current} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Next best action */}
          <div className="rounded-card p-5 text-white" style={{ background: 'var(--accent)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#A5B4FC] mb-1">Next Best Action</p>
            <h2 className="text-[18px] font-bold mb-1">{nba.title}</h2>
            <p className="text-[13px] text-[#C7D2FE] mb-4 leading-relaxed max-w-xl">{nba.body}</p>
            <Link href={nba.href} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-[var(--accent)] text-[13px] font-bold rounded-lg hover:bg-[#EEF2FF] transition-colors">
              {nba.icon} {nba.cta} <ArrowRight size={14} />
            </Link>
          </div>

          {/* Snapshot */}
          <div>
            <p className="text-[13px] font-semibold text-[var(--ink)] mb-3">Student Snapshot</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label={`GPA (${student.gpaType === 'Unweighted' ? 'UW' : 'W'})`} value={student.gpa || '—'} sub={student.gpaUnweighted ? `${student.gpaUnweighted} unweighted` : undefined} />
              <StatTile label={testLabel} value={testValue} accent />
              <StatTile label="Course Rigor" value={rigor} sub={`${student.apCount} APs`} />
              <StatTile label="Evidence Items" value={String(evidenceCount)} sub={confirmedCount ? `${confirmedCount} confirmed` : undefined} />
            </div>
          </div>

          {/* Readiness */}
          {dims && (
            <Card title="Readiness Summary" bodyClassName="px-6 py-5">
              <div className="flex flex-col gap-3">
                {(Object.keys(DIMENSION_LABELS) as DimensionKey[]).map(k => dims[k] && (
                  <QualBar key={k} label={DIMENSION_LABELS[k]} tier={dims[k].tier} />
                ))}
              </div>
              <p className="text-[11px] text-[var(--muted-2)] mt-3">Qualitative tiers — not scores. Reflect how the record may be read in context.</p>
            </Card>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <Card title="Key Strengths" bodyClassName="px-6 py-5">
              <ul className="flex flex-col gap-2">
                {strengths.slice(0, 5).map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--ink)] leading-relaxed">
                    <Star size={12} className="text-[var(--accent)] mt-1 shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right */}
        <div className="flex flex-col gap-5">
          {/* Alerts */}
          <div>
            <p className="text-[13px] font-semibold text-[var(--ink)] mb-3">Evidence Gaps & Alerts</p>
            <div className="flex flex-col gap-2.5">
              {alerts.length === 0 && (
                <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[12.5px] text-[var(--muted)]">
                  {v2 ? 'No structural risks flagged.' : 'Generate a strategy to surface gaps and risks.'}
                </div>
              )}
              {alerts.map((a, i) => (
                <AlertCard key={i} tone={a.severity === 'red' ? 'critical' : 'warning'} title={a.title} body={a.body} />
              ))}
            </div>
          </div>

          {/* Milestones */}
          {strategy && strategy.plan.length > 0 && (
            <Card title="Upcoming Milestones" bodyClassName="px-6 py-5">
              <ul className="flex flex-col gap-3">
                {strategy.plan.slice(0, 4).map((p, i, arr) => {
                  const critical = /nov|jan|dec/i.test(p.month);
                  const tone: Tone = critical ? 'critical' : 'accent';
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${tone === 'critical' ? 'bg-[#DC2626]' : 'bg-[var(--accent)]'}`} />
                        {i < arr.length - 1 && <div className="w-px h-7 bg-[var(--line)]" />}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--muted)]">{p.month}</p>
                        <p className="text-[13px] text-[var(--ink)] leading-snug">{p.tasks.split(/\.\s+/)[0]}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* Recent changes */}
          <Card title="Recent Blueprint Changes" bodyClassName="px-6 py-5">
            <ul className="flex flex-col gap-2 text-[12px] text-[var(--ink)]">
              {blueprint && <li><span className="text-[var(--muted)]">Blueprint — </span>{blueprint.draftLabel} generated</li>}
              {confirmed && <li><span className="text-[var(--muted)]">Identity — </span>positioning confirmed by student</li>}
              {positioning?.hypotheses?.length && !confirmed && <li><span className="text-[var(--muted)]">Identity — </span>{positioning.hypotheses.length} hypotheses generated</li>}
              {v2 && <li><span className="text-[var(--muted)]">Strategy — </span>generated (engine v{v2.engineVersion})</li>}
              <li><span className="text-[var(--muted)]">Profile — </span>updated {student.updated}</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
