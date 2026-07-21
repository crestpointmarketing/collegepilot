'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Layers, ArrowRight, ShieldAlert, Target, Rocket, Shield, Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SCHOOLS } from '@/lib/schools';
import { computeSchoolMatch, computeApplicationStrategy, type FitLevel } from '@/lib/admissions/schoolMatch';
import type { SchoolEvaluation, PortfolioSummary } from '@/lib/admissions/engine';
import {
  PageHeader, Card, Chip, AlertCard, EmptyState, StatTile, PrimaryButton,
  JourneyStepper, type Tone,
} from '@/components/ui';

const FIT_TONE: Record<FitLevel, Tone> = { Excellent: 'positive', Strong: 'accent', Moderate: 'warning', Limited: 'critical', Unknown: 'neutral' };

const RISK_TONE: Record<PortfolioSummary['shutoutRisk'], Tone> = {
  low: 'positive', moderate: 'warning', high: 'critical', critical: 'critical',
};

/** The three Kanban columns, in balancing order. */
const COLUMNS = [
  { bucket: 'reach' as const, label: 'Reach', Icon: Rocket, tone: 'critical' as Tone, hint: 'Aspirational — admit odds are a minority even for strong fits.' },
  { bucket: 'match' as const, label: 'Match', Icon: Target, tone: 'accent' as Tone, hint: 'Realistic — profile lands in the admitted range.' },
  { bucket: 'safety' as const, label: 'Safety', Icon: Shield, tone: 'positive' as Tone, hint: 'High-confidence admits that anchor the list.' },
];

const WARNING_TEXT: Record<string, { title: string; body: string }> = {
  no_admission_safety: {
    title: 'No true admission safety',
    body: 'Nothing on this list is a high-confidence admit. Add at least one genuine safety before finalizing.',
  },
  concentrated_in_gated_majors: {
    title: 'Concentrated in gated majors',
    body: 'Most pathways run through selective/gated admissions, so outcomes are highly correlated — one bad cycle can sink several at once.',
  },
  financial_safety_unknown: {
    title: 'Financial safety unconfirmed',
    body: 'At least one school offers no need-based aid for this student. Confirm an affordable admit exists regardless of merit awards.',
  },
  unmatched_preferred_schools: {
    title: 'Some preferred schools not analyzed',
    body: 'One or more schools on the family’s wish list are not in the database yet, so they are excluded from the coverage math.',
  },
};

interface PathwayCardData {
  schoolId: string;
  university: string;
  program: string;
  round: string;
  tierLabel: string;
  band: { min: number; max: number };
  overall: FitLevel;
  leverage: string;
}

export default function PortfolioPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, strategies } = useApp();
  const student = students.find(s => s.id === studentId);
  const v2 = strategies[studentId]?.v2 ?? null;

  const { columns, portfolio, suggestions } = useMemo(() => {
    if (!student || !v2?.assessment) return { columns: null, portfolio: null, suggestions: [] as PathwayCardData[] };
    const toCard = (ev: SchoolEvaluation): PathwayCardData | null => {
      const school = SCHOOLS.find(s => s.id === ev.schoolId);
      if (!school) return null;
      const match = computeSchoolMatch(student, school, v2.assessment);
      const strat = computeApplicationStrategy(student, school, v2.assessment, match);
      const leverage = strat.recommendedRound === 'ED' ? 'ED advantage'
        : strat.recommendedRound === 'REA' || strat.recommendedRound === 'EA' ? 'Early signal'
        : ev.uiBucket === 'safety' ? 'Safety anchor' : 'Regular round';
      return {
        schoolId: ev.schoolId,
        university: school.short,
        program: strat.suggestedMajor,
        round: strat.recommendedRound,
        tierLabel: ev.tierLabel,
        band: { min: ev.band.min, max: ev.band.max },
        overall: match.overall,
        leverage,
      };
    };
    const grouped: Record<'reach' | 'match' | 'safety', PathwayCardData[]> = { reach: [], match: [], safety: [] };
    (v2.evaluations ?? []).forEach(ev => {
      const card = toCard(ev);
      if (card && ev.uiBucket in grouped) grouped[ev.uiBucket].push(card);
    });
    const sugg = (v2.suggestions ?? []).map(toCard).filter((c): c is PathwayCardData => !!c);
    return { columns: grouped, portfolio: v2.portfolio, suggestions: sugg };
  }, [student, v2]);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  const header = <PageHeader title="Portfolio" sub="Balance the pathway list — coverage, correlation, and shutout risk across Reach / Match / Safety." />;

  if (!v2?.assessment || !columns || !portfolio) {
    return (
      <div className="animate-fade-in max-w-[1080px] mx-auto">
        {header}
        <EmptyState
          icon={<Layers size={24} />}
          title="Generate a strategy to build the portfolio"
          body="The portfolio is balanced from the admissions engine's per-school evaluation. Generate a strategy first, then return here to see coverage and risk."
          action={<PrimaryButton href={`/students/${studentId}/strategy`}>Generate a strategy <ArrowRight size={15} /></PrimaryButton>}
        />
      </div>
    );
  }

  const total = portfolio.coverage.reach + portfolio.coverage.match + portfolio.coverage.safety;
  const activeWarnings = portfolio.warnings.filter(w => WARNING_TEXT[w]);

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      {header}

      {/* Journey progress */}
      <Card className="mb-5"><JourneyStepper current={4} /></Card>

      {/* Coverage & risk header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatTile
          label="P(≥1 admit)"
          value={`${portfolio.pAtLeastOne.lowerPct}–${portfolio.pAtLeastOne.upperPct}%`}
          sub="Correlated floor → independent ceiling"
        />
        <StatTile label="Reach" value={String(portfolio.coverage.reach)} sub="aspirational" />
        <StatTile label="Match" value={String(portfolio.coverage.match)} sub="realistic" accent />
        <StatTile label="Safety" value={String(portfolio.coverage.safety)} sub="anchors" />
      </div>

      {/* Shutout risk banner */}
      <div className="mb-4">
        <AlertCard
          tone={RISK_TONE[portfolio.shutoutRisk]}
          title={`Shutout risk: ${portfolio.shutoutRisk}`}
          body={
            <>
              Across {total} pathway{total === 1 ? '' : 's'}, the modeled chance of at least one admit is{' '}
              <strong>{portfolio.pAtLeastOne.lowerPct}–{portfolio.pAtLeastOne.upperPct}%</strong>. {portfolio.pAtLeastOne.note}
            </>
          }
        />
      </div>

      {/* Structural warnings */}
      {activeWarnings.length > 0 && (
        <div className="flex flex-col gap-2.5 mb-5">
          {activeWarnings.map(w => (
            <AlertCard key={w} tone="warning" title={WARNING_TEXT[w].title} body={WARNING_TEXT[w].body} />
          ))}
        </div>
      )}

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const cards = columns[col.bucket];
          return (
            <div key={col.bucket} className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <col.Icon size={15} className="text-[var(--muted)]" />
                <h2 className="text-[14px] font-bold text-[var(--ink)]">{col.label}</h2>
                <Chip tone={col.tone}>{cards.length}</Chip>
              </div>
              <p className="text-[11.5px] text-[var(--muted)] mb-3 leading-snug">{col.hint}</p>

              <div className="flex flex-col gap-2.5">
                {cards.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-soft)] px-4 py-6 text-center text-[12px] text-[var(--muted)]">
                    No {col.label.toLowerCase()} schools on this list.
                  </div>
                )}
                {cards.map(c => (
                  <Link
                    key={c.schoolId}
                    href={`/students/${studentId}/schools/${c.schoolId}`}
                    className="block bg-white rounded-xl border border-[var(--line)] shadow-card p-4 hover:border-[var(--accent)]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="text-[14px] font-bold text-[var(--ink)] leading-tight">{c.university}</h3>
                      <Chip tone={FIT_TONE[c.overall]}>{c.overall}</Chip>
                    </div>
                    <p className="text-[12px] text-[var(--muted)] mb-2.5 leading-snug">{c.program}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip tone="neutral">{c.round}</Chip>
                      <span className="text-[11px] font-semibold text-[var(--accent)] bg-[var(--accent-50)] px-2 py-0.5 rounded-full">{c.leverage}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--line)]">
                      <span className="text-[11.5px] text-[var(--muted)]">{c.tierLabel} · <span className="tabular-nums">{c.band.min}–{c.band.max}%</span></span>
                      <ArrowRight size={13} className="text-[var(--accent)]" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Engine-suggested additions to patch coverage */}
      {suggestions.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-1">
            <Plus size={15} className="text-[var(--accent)]" />
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Suggested additions</h2>
          </div>
          <p className="text-[11.5px] text-[var(--muted)] mb-3 leading-snug">
            Not on {student.name.split(' ')[0]}’s list — the engine proposes these to patch coverage gaps. Discuss with the family before adding.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {suggestions.map(c => (
              <Link
                key={c.schoolId}
                href={`/students/${studentId}/schools/${c.schoolId}`}
                className="block rounded-xl border border-dashed border-[var(--accent-100)] bg-[var(--accent-50)]/40 p-4 hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-[13.5px] font-bold text-[var(--ink)]">{c.university}</h3>
                  <Chip tone={FIT_TONE[c.overall]}>{c.overall}</Chip>
                </div>
                <p className="text-[11.5px] text-[var(--muted)] mb-2 leading-snug">{c.program}</p>
                <span className="text-[11px] text-[var(--muted)]">{c.tierLabel} · <span className="tabular-nums">{c.band.min}–{c.band.max}%</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between rounded-xl border border-[var(--line)] bg-white shadow-card px-5 py-4 flex-wrap gap-3">
        <div>
          <div className="text-[13.5px] font-semibold text-[var(--ink)]">Ready to design the applications?</div>
          <div className="text-[12px] text-[var(--muted)] mt-0.5">Continue to the Blueprint — the person before the application.</div>
        </div>
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-[var(--muted)]" />
          <PrimaryButton href={`/students/${studentId}/blueprint`}>Go to Blueprint <ArrowRight size={15} /></PrimaryButton>
        </div>
      </div>
    </div>
  );
}
