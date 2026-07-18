'use client';

/**
 * Shared building blocks for the assessment-driven pages (Assessment,
 * Overview). Everything renders engine/assessment data verbatim — no
 * invented scores.
 */

import { ShieldCheck, Landmark, Link2, UserRound, TriangleAlert, CircleHelp } from 'lucide-react';
import type { StrategyV2 } from '@/types';

export type V2Dimension = StrategyV2['assessment']['dimensions'][string];

/* ── Dimension taxonomy ────────────────────────────────────── */

export const DIMENSION_GROUPS: { title: string; color: string; keys: string[] }[] = [
  {
    title: 'Academic Foundation',
    color: '#0d9488',
    keys: ['academic_readiness', 'curriculum_rigor_in_context', 'major_preparation', 'intellectual_vitality'],
  },
  {
    title: 'Distinction & Story',
    color: '#ea580c',
    keys: ['extracurricular_distinction', 'leadership_impact', 'narrative_coherence'],
  },
  {
    title: 'Application Context',
    color: '#2563eb',
    keys: ['institutional_fit', 'application_readiness', 'financial_residency_context'],
  },
];

export const DIMENSION_LABELS: Record<string, string> = {
  academic_readiness: 'Academic Readiness',
  curriculum_rigor_in_context: 'Contextual Rigor',
  major_preparation: 'Major Preparation',
  intellectual_vitality: 'Intellectual Vitality',
  extracurricular_distinction: 'Activity Distinction',
  leadership_impact: 'Leadership & Impact',
  narrative_coherence: 'Narrative Coherence',
  institutional_fit: 'Institutional Fit',
  application_readiness: 'Application Readiness',
  financial_residency_context: 'Financial & Residency',
};

export const TIER_SCORE: Record<string, number> = {
  exceptional: 5, strong: 4, solid: 3, developing: 2, concern: 1,
};

/* ── Verification states ──────────────────────────────────── */

export const VERIFICATION_META: Record<string, { label: string; color: string; Icon: typeof ShieldCheck }> = {
  externally_verified: { label: 'Externally verified', color: '#059669', Icon: ShieldCheck },
  institution_affiliated: { label: 'Institution affiliated', color: '#2563eb', Icon: Landmark },
  link_verified: { label: 'Link verified', color: '#d97706', Icon: Link2 },
  self_reported_only: { label: 'Self-reported', color: '#dc2626', Icon: UserRound },
  conflicting_or_incomplete: { label: 'Conflicting / incomplete', color: '#9333ea', Icon: TriangleAlert },
  // Legacy value from pre-taxonomy assessments
  plausible: { label: 'Plausible (legacy)', color: '#64748b', Icon: CircleHelp },
};

export function VerificationBadge({ state, compact = false }: { state: string; compact?: boolean }) {
  const meta = VERIFICATION_META[state] ?? VERIFICATION_META.plausible;
  const Icon = meta.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded border"
      style={{ color: meta.color, borderColor: `${meta.color}44`, background: `${meta.color}0d` }}
      title={meta.label}
    >
      <Icon size={10} />{!compact && meta.label}
    </span>
  );
}

export const CONF_CHIP: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-red-50 text-red-600 border-red-200',
};

/** Single source for tier-bucket badge classes — keep every page in sync. */
export const BUCKET_BADGE: Record<string, string> = {
  reach: 'bg-red-50 text-red-600 border-red-200',
  match: 'bg-amber-50 text-amber-700 border-amber-200',
  safety: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** Single source for tier-bucket chart colors (bars, scatter, legends). */
export const CHART_BUCKET_COLOR: Record<string, string> = {
  reach: '#f87171',
  match: '#fbbf24',
  safety: '#34d399',
};

/** Single source for shutout-risk styling. */
export const SHUTOUT_STYLE: Record<string, string> = {
  low: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  moderate: 'bg-amber-50 border-amber-200 text-amber-700',
  high: 'bg-orange-50 border-orange-200 text-orange-700',
  critical: 'bg-red-50 border-red-200 text-red-700',
};

export function ConfidenceChip({ level }: { level: string }) {
  return (
    <span className={`inline-flex text-[10.5px] font-semibold capitalize px-2 py-0.5 rounded-pill border ${CONF_CHIP[level] ?? CONF_CHIP.medium}`}>
      {level}
    </span>
  );
}

/* ── Tier bar (5 segments) ────────────────────────────────── */

export function TierBar({ tier, color }: { tier: string; color: string }) {
  const score = TIER_SCORE[tier] ?? 3;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className="w-5 h-2.5 rounded-sm" style={{ background: i <= score ? color : '#e2e8f0' }} />
        ))}
      </div>
      <span className="text-[11.5px] font-semibold capitalize" style={{ color }}>{tier}</span>
    </div>
  );
}

/* ── Evidence quality donut ───────────────────────────────── */

export function EvidenceDonut({ dimensions }: { dimensions: Record<string, V2Dimension> }) {
  const counts = new Map<string, number>();
  for (const d of Object.values(dimensions)) {
    counts.set(d.verifiability, (counts.get(d.verifiability) ?? 0) + 1);
  }
  const total = Object.keys(dimensions).length || 1;
  const order = ['externally_verified', 'institution_affiliated', 'link_verified', 'self_reported_only', 'conflicting_or_incomplete', 'plausible'];
  const entries = order.filter(k => counts.has(k)).map(k => ({ key: k, n: counts.get(k)!, meta: VERIFICATION_META[k] }));

  const r = 34, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={96} height={96} viewBox="0 0 96 96">
        {entries.map(e => {
          const frac = e.n / total;
          const seg = (
            <circle
              key={e.key}
              cx={48} cy={48} r={r} fill="none"
              stroke={e.meta.color} strokeWidth={11}
              strokeDasharray={`${frac * c - 1.5} ${c - frac * c + 1.5}`}
              strokeDashoffset={-offset * c}
              transform="rotate(-90 48 48)"
            />
          );
          offset += frac;
          return seg;
        })}
        <text x={48} y={45} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)">{total}</text>
        <text x={48} y={58} textAnchor="middle" fontSize={8.5} fill="var(--muted)">dimensions</text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {entries.map(e => (
          <div key={e.key} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: e.meta.color }} />
            <span className="text-[var(--ink-soft)]">{e.meta.label}</span>
            <span className="ml-auto font-bold text-[var(--ink)] pl-3">{e.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Structural alerts (shared: Overview + Schools portfolio) ── */

export interface PortfolioAlert {
  severity: 'red' | 'amber';
  title: string;
  body: string;
  href: string;
  cta: string;
}

export function derivePortfolioAlerts(
  v2: StrategyV2,
  studentId: string,
  notAttendIds: string[] = [],
): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];
  const portfolio = v2.portfolio;
  const evals = v2.evaluations ?? [];
  const dims = v2.assessment.dimensions;
  const trueSafeties = evals.filter(e => e.tierLabel === 'Very Likely' && !notAttendIds.includes(e.schoolId)).length;

  if (portfolio.warnings.includes('no_admission_safety')) {
    alerts.push({ severity: 'red', title: 'No admission safety', body: 'No school on the list is Likely or better — shutout exposure is structural.', href: `/students/${studentId}/strategy`, cta: 'See suggestions' });
  }
  const unattendedSafeties = evals.filter(e =>
    (e.tierLabel === 'Likely' || e.tierLabel === 'Very Likely') && notAttendIds.includes(e.schoolId));
  if (unattendedSafeties.length) {
    alerts.push({ severity: 'red', title: 'Safety fails the acceptability test', body: `${unattendedSafeties.map(e => e.short).join(', ')}: the student would not actually attend — a safety no one would enroll at is not a safety.`, href: `/students/${studentId}/schools`, cta: 'Review list' });
  }
  if (trueSafeties === 0 && !portfolio.warnings.includes('no_admission_safety')) {
    alerts.push({ severity: 'amber', title: 'No true safety confirmed', body: 'No acceptable school clears all three gates (admission + major access + affordability). Confirm aid status or add options.', href: `/students/${studentId}/profile`, cta: 'Update profile' });
  }
  if (portfolio.warnings.includes('concentrated_in_gated_majors')) {
    alerts.push({ severity: 'amber', title: 'Gated-major concentration', body: 'Most of the list runs through capped CS/engineering admissions — outcomes will be highly correlated.', href: `/students/${studentId}/strategy`, cta: 'Rebalance list' });
  }
  if (portfolio.warnings.includes('financial_safety_unknown')) {
    alerts.push({ severity: 'amber', title: 'Financial safety unconfirmed', body: 'At least one school offers no need-based aid for this student.', href: `/students/${studentId}/profile`, cta: 'Review budget' });
  }
  const overstated = Object.entries(dims).filter(([, d]) => d.overstatement_risk === 'high' || d.overstatement_risk === 'medium');
  if (overstated.length) {
    alerts.push({ severity: 'amber', title: `${overstated.length} claim${overstated.length > 1 ? 's' : ''} need verification`, body: overstated.map(([k]) => DIMENSION_LABELS[k] ?? k).join(', '), href: `/students/${studentId}/assessment`, cta: 'Verify evidence' });
  }
  if (portfolio.unmatchedPreferred?.length) {
    alerts.push({ severity: 'amber', title: 'Unrecognized schools on list', body: `Not analyzed: ${portfolio.unmatchedPreferred.join(', ')}`, href: `/students/${studentId}/profile`, cta: 'Fix list' });
  }
  return alerts;
}

/* ── Readiness math (shared with the sidebar ring) ────────── */

export function computeReadiness(dimensions: Record<string, { confidence: string }>) {
  const levels = Object.values(dimensions).map(d => d.confidence);
  const high = levels.filter(l => l === 'high').length;
  const medium = levels.filter(l => l === 'medium').length;
  const low = levels.filter(l => l === 'low').length;
  const total = Math.max(1, levels.length);
  return { pct: Math.round(((high * 100) + (medium * 60) + (low * 25)) / total), high, medium, low };
}
