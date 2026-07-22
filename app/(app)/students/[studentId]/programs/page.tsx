'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Search, GraduationCap, ArrowRight, FlaskConical } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SCHOOLS } from '@/lib/schools';
import { computeSchoolMatch, computeApplicationStrategy, type FitLevel } from '@/lib/admissions/schoolMatch';
import { PageHeader, Chip, AlertCard, EmptyState, PrimaryButton, type Tone } from '@/components/ui';
import { isDirectionConfirmed } from '@/lib/admissions/journey';

const FIT_TONE: Record<FitLevel, Tone> = { Excellent: 'positive', Strong: 'accent', Moderate: 'warning', Limited: 'critical', Unknown: 'neutral' };
const BUCKET_TONE: Record<string, Tone> = { reach: 'warning', match: 'accent', safety: 'positive' };

export default function ProgramsPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, strategies } = useApp();
  const student = students.find(s => s.id === studentId);
  const v2 = strategies[studentId]?.v2 ?? null;
  const [q, setQ] = useState('');

  const pathways = useMemo(() => {
    if (!student || !v2?.assessment) return [];
    return (v2.evaluations ?? []).map(ev => {
      const school = SCHOOLS.find(s => s.id === ev.schoolId);
      if (!school) return null;
      const match = computeSchoolMatch(student, school, v2.assessment);
      const strat = computeApplicationStrategy(student, school, v2.assessment, match);
      const leverage = strat.recommendedRound === 'ED' ? 'ED Advantage'
        : strat.recommendedRound === 'REA' || strat.recommendedRound === 'EA' ? 'Early Signal'
        : ev.uiBucket === 'safety' ? 'Safety Anchor' : 'Standard Round';
      return {
        schoolId: ev.schoolId,
        university: school.short,
        program: strat.suggestedMajor,
        round: strat.recommendedRound,
        likelihood: ev.tierLabel,
        bucket: ev.uiBucket,
        overall: match.overall,
        leverage,
        axes: match.axes.slice(0, 5),
      };
    }).filter((p): p is NonNullable<typeof p> => !!p);
  }, [student, v2]);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  const directionReady = isDirectionConfirmed(student.direction);
  const filtered = q.trim()
    ? pathways.filter(p => `${p.university} ${p.program}`.toLowerCase().includes(q.trim().toLowerCase()))
    : pathways;

  const header = (
    <PageHeader
      title="Programs & Schools"
      sub="Application Pathways — University → College → Program → Round"
      actions={
        <Link href={`/students/${studentId}/research`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--line-strong)] text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors">
          <FlaskConical size={14} /> Admission intelligence
        </Link>
      }
    />
  );

  if (!v2?.assessment) {
    return (
      <div className="animate-fade-in max-w-[1080px] mx-auto">
        {header}
        <EmptyState
          icon={<GraduationCap size={24} />}
          title="Generate a strategy to discover pathways"
          body="Application Pathways are derived from the admissions engine's per-school evaluation. Generate a strategy first."
          action={<PrimaryButton href={`/students/${studentId}/strategy`}>Generate a strategy <ArrowRight size={15} /></PrimaryButton>}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      {header}
      {!directionReady && (
        <AlertCard tone="info" title="Confirm an academic direction for sharper pathways."
          body="Pathways below come from the engine's school evaluation. Confirming a direction focuses program recommendations." />
      )}

      <div className="mt-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search schools, programs…"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[var(--line-strong)] bg-white text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        />
      </div>

      <p className="text-[12px] text-[var(--muted)] mt-3 mb-2">{filtered.length} pathway{filtered.length === 1 ? '' : 's'}</p>

      <div className="flex flex-col gap-3">
        {filtered.map(p => (
          <Link key={p.schoolId} href={`/students/${studentId}/schools/${p.schoolId}`}
            className="block bg-white rounded-xl border border-[var(--line)] p-4 hover:border-[var(--accent)]/40 hover:shadow-[var(--shadow-card)] transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Chip tone={BUCKET_TONE[p.bucket] ?? 'accent'}>{p.likelihood}</Chip>
                  <Chip tone="neutral">{p.round}</Chip>
                  <span className="text-[11px] text-[var(--accent)] font-semibold bg-[#EEF0F8] px-2 py-0.5 rounded-full">{p.leverage}</span>
                </div>
                <h3 className="text-[15px] font-bold text-[var(--ink)]">{p.university}</h3>
                <p className="text-[12.5px] text-[var(--muted)]">{p.program}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-[var(--muted)] mb-1">Overall Fit</p>
                <Chip tone={FIT_TONE[p.overall]}>{p.overall}</Chip>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {p.axes.map((ax, i) => (
                <span key={i} className="text-[11px] text-[var(--muted)] bg-[var(--bg-soft)] px-2 py-0.5 rounded-full">
                  {ax.label.replace(/ Fit$/, '')}: <span className={`font-semibold ${ax.level === 'Unknown' ? 'text-[var(--muted-2)]' : ax.level === 'Excellent' || ax.level === 'Strong' ? 'text-[#16A34A]' : ax.level === 'Limited' ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>{ax.level}</span>
                </span>
              ))}
              <span className="ml-auto text-[var(--accent)] text-[12px] font-semibold inline-flex items-center gap-1">View <ArrowRight size={12} /></span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
