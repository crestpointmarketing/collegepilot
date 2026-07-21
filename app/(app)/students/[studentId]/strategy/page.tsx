'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Sparkles, ArrowRight, Check,
  TrendingUp, TrendingDown, Minus,
  CheckCircle2, AlertCircle,
  Rocket, Target, Shield,
  CalendarDays, PenLine,
  BarChart3, Zap,
  User, BarChart2, GraduationCap, Lightbulb, ListTodo, Plus, X,
  ChevronDown, ChevronRight, Quote,
  FlaskConical, BookOpen, Eye, TriangleAlert,
  ShieldAlert, Info, Database,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, LabelList,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { LOADING_STEPS } from '@/lib/data';
import { strategySchema } from '@/lib/schemas';
import { getSchoolFacts } from '@/lib/admissions/schoolFacts';
import { evaluateSchool, extractStudentNumbers } from '@/lib/admissions/engine';
import { SCHOOLS } from '@/lib/schools';
import { BUCKET_BADGE, CHART_BUCKET_COLOR, CONF_CHIP, SHUTOUT_STYLE } from '@/components/assessment/ui';
import type { Strategy, StrategyLever, StrategyV2, Student as StudentT } from '@/types';

/* ── Types ────────────────────────────────────────────────── */

interface ParsedLever {
  action: string;
  impactText: string;
  ppMin: number;
  ppMax: number;
  ppMid: number;
  scope: 'reach' | 'match' | 'reach+match' | 'all';
}

interface LeverState {
  active: boolean;
  strength: 0.5 | 1; // partial or full
}

/* ── Parsing ──────────────────────────────────────────────── */

function parseLever(text: string): ParsedLever {
  const sep = text.indexOf(' → ');
  const action = sep >= 0 ? text.slice(0, sep).trim() : text.trim();
  const impactText = sep >= 0 ? text.slice(sep + 3).trim() : '';
  const rangeMatch = impactText.match(/\+(\d+)[–\-](\d+)\s*pp/i);
  const singleMatch = impactText.match(/\+(\d+)\s*pp/i);
  let ppMin = 4, ppMax = 6;
  if (rangeMatch) { ppMin = parseInt(rangeMatch[1]); ppMax = parseInt(rangeMatch[2]); }
  else if (singleMatch) { ppMin = ppMax = parseInt(singleMatch[1]); }
  const ppMid = Math.round((ppMin + ppMax) / 2);
  const low = impactText.toLowerCase();
  const scope: ParsedLever['scope'] =
    (low.includes('reach') && (low.includes('match') || low.includes('upper-match'))) ? 'reach+match'
    : low.includes('all school') ? 'all'
    : low.includes('match') && !low.includes('reach') ? 'match'
    : 'reach';
  return { action, impactText, ppMin, ppMax, ppMid, scope };
}

function parseChance(chance: string): number {
  const m = chance.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function levelToScore(level: string): number {
  if (level.includes('Very High')) return 90;
  if (level === 'High') return 78;
  if (level.includes('Medium-High') || level.includes('Medium High')) return 62;
  if (level === 'Medium') return 48;
  if (level.includes('Medium-Low') || level.includes('Medium Low')) return 32;
  return 18;
}

function computeAdjustments(
  schools: Strategy['schools'],
  parsedLevers: ParsedLever[],
  leverStates: Record<number, LeverState>,
): Record<string, number> {
  const adj: Record<string, number> = {};
  parsedLevers.forEach((lv, i) => {
    const st = leverStates[i];
    if (!st?.active) return;
    const boost = lv.ppMid * st.strength;
    const affected =
      lv.scope === 'all' ? [...schools.reach, ...schools.match, ...schools.safety]
      : lv.scope === 'reach+match' ? [...schools.reach, ...schools.match]
      : lv.scope === 'match' ? schools.match
      : schools.reach;
    affected.forEach(s => { adj[s.name] = (adj[s.name] ?? 0) + boost; });
  });
  return adj;
}

function computePortfolioProb(schools: Strategy['schools'], adj: Record<string, number>): number {
  const all = [...schools.reach, ...schools.match, ...schools.safety];
  const complement = all.reduce((acc, s) => {
    const p = Math.min(0.99, (parseChance(s.chance) + (adj[s.name] ?? 0)) / 100);
    return acc * (1 - p);
  }, 1);
  return Math.round((1 - complement) * 100);
}

/* ── Probability Gauge ────────────────────────────────────── */

function ProbabilityGauge({ value, adjusted, range }: { value: string; adjusted?: number; range?: { min: number; max: number } }) {
  const original = range ? Math.round((range.min + range.max) / 2) : parseChance(value);
  const display = adjusted ?? original;
  const changed = adjusted !== undefined && adjusted !== original;
  const r = 46, cx = 62, cy = 64;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const startAngle = -210, sweep = 240;
  const arcPath = (p: number) => {
    const angle = startAngle + (sweep * Math.min(p, 99)) / 100;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(angle));
    const y2 = cy + r * Math.sin(toRad(angle));
    const large = sweep * p / 100 > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const color = display >= 70 ? '#059669' : display >= 40 ? '#d97706' : '#dc2626';
  const delta = display - original;

  return (
    <div className="flex flex-col items-center">
      <svg width={124} height={112} viewBox="0 0 124 112">
        <path d={arcPath(100)} fill="none" stroke="#e2e8f0" strokeWidth={8} strokeLinecap="round" />
        {changed && (
          <path d={arcPath(original)} fill="none" stroke="#cbd5e1" strokeWidth={8} strokeLinecap="round" strokeDasharray="4 3" />
        )}
        {range && (
          <path d={arcPath(range.max)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeOpacity={0.25} />
        )}
        <path d={arcPath(range ? range.min : display)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
        {range ? (
          <text x={cx} y={cy + 2} textAnchor="middle" fontSize={17} fontWeight={700} fill={color}>{range.min}–{range.max}%</text>
        ) : (
          <text x={cx} y={cy + 2} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>{display}%</text>
        )}
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={9} fill="#94a3b8" letterSpacing={0.5}>{range ? 'P(≥1 ADMIT) RANGE' : 'P(≥1 ADMIT)'}</text>
      </svg>
      {range && (
        <div className="text-[10px] text-[var(--muted)] text-center leading-snug max-w-[130px] -mt-0.5">
          solid = correlated floor · faint = independent ceiling
        </div>
      )}
      {changed && delta !== 0 && (
        <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full -mt-1 ${delta > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          {delta > 0 ? '+' : ''}{delta}pp vs baseline
        </div>
      )}
    </div>
  );
}

/* ── Interactive Lever Card ───────────────────────────────── */

function LeverCard({
  parsed, state, index,
  onChange,
}: {
  parsed: ParsedLever; state?: LeverState; index: number;
  onChange: (i: number, st: LeverState | null) => void;
}) {
  const active = state?.active ?? false;
  const strength = state?.strength ?? 1;

  return (
    <div className={`rounded-lg border transition-all ${active ? 'border-[var(--accent)] bg-white shadow-sm' : 'border-[var(--line)] bg-[var(--bg-soft)]'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={() => onChange(index, active ? null : { active: true, strength: 1 })}
          aria-label={active ? 'Remove this improvement from the simulation' : 'Apply this improvement to the simulation'}
          className={`h-7 rounded-md shrink-0 inline-flex items-center gap-1.5 px-2.5 text-[11px] font-semibold transition-colors ${
            active
              ? 'text-white'
              : 'border border-[var(--line-strong)] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          }`}
          style={active ? { background: 'var(--accent)' } : {}}
        >
          {active ? <Check size={11} strokeWidth={3} /> : <Plus size={11} />}
          {active ? 'Applied' : 'Apply'}
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className={`text-[12.5px] font-semibold leading-snug truncate ${active ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}>
            {parsed.action}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${active ? 'bg-[var(--accent-50)] text-[var(--accent)]' : 'bg-[var(--line)] text-[var(--muted)]'}`}>
              +{parsed.ppMin}–{parsed.ppMax}pp
            </span>
            <span className="text-[11px] text-[var(--muted)] truncate capitalize">{parsed.scope.replace('+', ' + ')} schools</span>
          </div>
        </div>
      </div>

      {/* Strength selector — only when active */}
      {active && (
        <div className="px-3 pb-3 flex items-center gap-2">
          <span className="text-[10.5px] text-[var(--muted)] font-medium shrink-0">Impact strength:</span>
          <div className="flex gap-1.5">
            {([0.5, 1] as const).map(s => (
              <button
                key={s}
                onClick={() => onChange(index, { active: true, strength: s })}
                className={`px-2.5 py-0.5 rounded-pill text-[11px] font-semibold transition-colors ${strength === s ? 'text-white' : 'border border-[var(--line-strong)] text-[var(--muted)] hover:border-[var(--accent)]'}`}
                style={strength === s ? { background: 'var(--accent)' } : {}}
              >
                {s === 0.5 ? `Partial (+${Math.round(parsed.ppMid * 0.5)}pp)` : `Full (+${parsed.ppMid}pp)`}
              </button>
            ))}
          </div>
          <button onClick={() => onChange(index, null)} className="ml-auto text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── School Chart with adjustments ───────────────────────── */

function SchoolChart({ schools, adjustments }: { schools: Strategy['schools']; adjustments: Record<string, number> }) {
  const tierColor = CHART_BUCKET_COLOR;
  const hasAdj = Object.values(adjustments).some(v => v > 0);

  const data = [
    ...schools.reach.map(s => ({ name: s.name, tier: 'reach', original: parseChance(s.chance) })),
    ...schools.match.map(s => ({ name: s.name, tier: 'match', original: parseChance(s.chance) })),
    ...schools.safety.map(s => ({ name: s.name, tier: 'safety', original: parseChance(s.chance) })),
  ]
    .map(s => ({
      ...s,
      delta: Math.max(0, Math.round(adjustments[s.name] ?? 0)),
      adjusted: Math.min(99, s.original + Math.round(adjustments[s.name] ?? 0)),
    }))
    .sort((a, b) => a.original - b.original);

  // Truncate long school names to keep the Y-axis single-line
  const truncate = (name: string, max = 26) =>
    name.length > max ? name.slice(0, max - 1) + '…' : name;

  const renderTick = ({ x, y, payload }: { x?: string | number; y?: string | number; payload?: { value?: string | number } }) => (
    <g transform={`translate(${x},${y})`}>
      <title>{payload?.value}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" fontSize={11.5} fill="#334155">
        {truncate(String(payload?.value ?? ''))}
      </text>
    </g>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          Admit Probability {hasAdj && <span className="text-[var(--accent)] normal-case tracking-normal font-normal ml-1">— adjustments applied</span>}
        </span>
        <div className="flex items-center gap-3">
          {(['reach', 'match', 'safety'] as const).map(t => (
            <div key={t} className="flex items-center gap-1 text-[10.5px] text-[var(--muted)]">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: tierColor[t] }} />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={data.length * 44 + 20}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
            tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={170}
            tick={renderTick} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#f8fafc' }}
            formatter={(_v, _n, item) => {
              const d = item.payload;
              const base = `${d.original}%`;
              return d.delta > 0 ? [`${d.original}% → ${d.adjusted}% (+${d.delta}pp)`, 'Admit chance'] : [base, 'Admit chance'];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          {/* Base bar */}
          <Bar dataKey="original" stackId="a" maxBarSize={22} radius={hasAdj ? [0, 0, 0, 0] : [0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={tierColor[d.tier]} fillOpacity={hasAdj ? 0.28 : 0.85} />
            ))}
          </Bar>
          {/* Delta bar */}
          {hasAdj && (
            <Bar dataKey="delta" stackId="a" maxBarSize={22} radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={tierColor[d.tier]} fillOpacity={d.delta > 0 ? 1 : 0} />
              ))}
              <LabelList
                content={(props) => {
                  const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                  const d = data[index];
                  if (!d || d.delta === 0) return null;
                  return (
                    <text x={(x as number) + (width as number) + 6} y={(y as number) + (height as number) / 2 + 4}
                      fontSize={10.5} fontWeight={600} fill="#059669">
                      +{d.delta}pp
                    </text>
                  );
                }}
              />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Competitiveness Chart ────────────────────────────────── */

function CompetitivenessChart({ comp }: { comp: Strategy['competitiveness'] }) {
  const rows = [
    { tier: 'Top 10', level: comp.top10.level, score: levelToScore(comp.top10.level) },
    { tier: 'Top 20', level: comp.top20.level, score: levelToScore(comp.top20.level) },
    { tier: 'Top 50', level: comp.top50.level, score: levelToScore(comp.top50.level) },
  ];
  return (
    <div className="flex gap-8 items-center mb-5">
      <div className="shrink-0">
        <ResponsiveContainer width={180} height={160}>
          <RadarChart data={rows} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="tier" tick={{ fontSize: 11, fill: '#64748b' }} />
            <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.18} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 flex flex-col gap-4">
        {rows.map(({ tier, level, score }) => {
          const isHigh = level.includes('High'), isMed = level.includes('Medium');
          const Icon = isHigh ? TrendingUp : isMed ? Minus : TrendingDown;
          const color = isHigh ? '#10b981' : isMed ? '#f59e0b' : '#f87171';
          const barCls = isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-400' : 'bg-red-400';
          return (
            <div key={tier}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink)]">{tier}</span>
                <div className="flex items-center gap-1 text-[12px] font-medium" style={{ color }}>
                  <Icon size={13} />{level}
                </div>
              </div>
              <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barCls}`} style={{ width: `${score}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── V2: engine-audit components ──────────────────────────── */

type V2Evaluation = StrategyV2['evaluations'][number];

function ConfChip({ kind, level }: { kind: 'Data' | 'Profile'; level: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${CONF_CHIP[level] ?? CONF_CHIP.medium}`}
      title={kind === 'Data'
        ? 'How reliable the school-side data (admit rates, policies) is for this estimate'
        : 'How complete the student profile was for this judgment'}
    >
      {kind === 'Data' ? <Database size={9} /> : <Eye size={9} />}
      {kind}: {level}
    </span>
  );
}

function TierRangeBadge({ ev }: { ev: V2Evaluation }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-pill border ${BUCKET_BADGE[ev.uiBucket]}`}>
      {ev.tierLabel} · {ev.band.min}–{ev.band.max}%
    </span>
  );
}

const BASIS_LABEL: Record<string, string> = {
  official_fact: 'Official data',
  derived_stat: 'Derived stat',
  llm_assessment: 'AI profile read',
  policy_rule: 'Calibration rule',
  expert_estimate: 'Counselor judgment',
};

function TraceDisclosure({ ev }: { ev: V2Evaluation }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11.5px] font-medium transition-colors"
        style={{ color: 'var(--accent)' }}
      >
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        Why {ev.tierLabel.toLowerCase()}? ({ev.trace.length} factors)
        <span className="flex items-center gap-1 ml-1">
          <ConfChip kind="Data" level={ev.dataConfidence} />
          <ConfChip kind="Profile" level={ev.assessmentConfidence} />
        </span>
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-lg bg-white border border-[var(--line)] p-3">
          {ev.trace.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-[11.5px]">
              <span className={`shrink-0 mt-px w-9 text-center font-bold rounded px-1 ${
                t.stepDelta > 0 ? 'text-emerald-600 bg-emerald-50'
                : t.stepDelta < 0 ? 'text-red-500 bg-red-50'
                : 'text-slate-400 bg-slate-50'
              }`}>
                {t.stepDelta > 0 ? `+${t.stepDelta}` : t.stepDelta < 0 ? `${t.stepDelta}` : 'info'}
              </span>
              <div className="min-w-0">
                <span className="font-semibold text-[var(--ink)]">{t.label}</span>
                <span className="text-[var(--muted)]"> — {t.rationale}</span>
                <span className="ml-1 text-[10px] text-[var(--muted-2)] whitespace-nowrap">[{BASIS_LABEL[t.basis] ?? t.basis}]</span>
              </div>
            </div>
          ))}
          <div className="text-[10.5px] text-[var(--muted)] pt-1 border-t border-[var(--line)]">
            Tier steps move within hard selectivity caps: {ev.ceilingReason.toLowerCase()}
          </div>
        </div>
      )}
    </div>
  );
}

function ShutoutStrip({ portfolio }: { portfolio: StrategyV2['portfolio'] }) {
  const { coverage } = portfolio;
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${SHUTOUT_STYLE[portfolio.shutoutRisk]}`}>
      <ShieldAlert size={15} className="shrink-0" />
      <div className="text-[12px] leading-snug">
        <span className="font-bold capitalize">Shutout risk: {portfolio.shutoutRisk}.</span>{' '}
        List covers {coverage.reach} reach / {coverage.match} match / {coverage.safety} safety.
        {portfolio.warnings.includes('no_admission_safety') && ' No school on this list is a true admission safety — see suggested additions below.'}
        {portfolio.warnings.includes('concentrated_in_gated_majors') && ' Most of the list runs through gated CS admissions — outcomes will be highly correlated.'}
        {portfolio.warnings.includes('financial_safety_unknown') && ' At least one school offers no need aid for this student — financial safety unconfirmed.'}
        {portfolio.warnings.includes('unmatched_preferred_schools') && ` Not analyzed (not in the school database): ${(portfolio.unmatchedPreferred ?? []).join(', ')}.`}
      </div>
    </div>
  );
}

function formatDimension(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const DIM_TIER_STYLE: Record<string, string> = {
  exceptional: 'bg-violet-50 border-violet-200 text-violet-700',
  strong: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  solid: 'bg-slate-50 border-slate-200 text-slate-600',
  developing: 'bg-amber-50 border-amber-200 text-amber-700',
  concern: 'bg-red-50 border-red-200 text-red-600',
};

function DimensionGrid({ assessment }: { assessment: StrategyV2['assessment'] }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
        <BarChart2 size={11} /> Ten-Dimension Profile Grades
        <span className="normal-case tracking-normal font-normal">— hover for evidence</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {Object.entries(assessment.dimensions).map(([key, d]) => (
          <div
            key={key}
            className={`rounded-lg border px-2.5 py-2 ${DIM_TIER_STYLE[d.tier] ?? DIM_TIER_STYLE.solid}`}
            title={`${d.evidence[0] ?? 'No evidence cited'}${d.missing.length ? ` | Missing: ${d.missing[0]}` : ''} | Verifiability: ${d.verifiability.replace(/_/g, ' ')}`}
          >
            <div className="text-[10px] font-medium leading-tight opacity-80">{formatDimension(key)}</div>
            <div className="text-[12.5px] font-bold capitalize flex items-center gap-1">
              {d.tier}
              {d.verifiability === 'self_reported_only' && <Info size={10} className="opacity-60" aria-label="Self-reported only" />}
            </div>
          </div>
        ))}
      </div>
      {assessment.assessment_gaps.length > 0 && (
        <div className="mt-2 text-[11px] text-[var(--muted)] flex items-start gap-1.5">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>Assessment gaps: {assessment.assessment_gaps.slice(0, 3).join('; ')}</span>
        </div>
      )}
    </div>
  );
}

function V2LeverList({ levers }: { levers: StrategyLever[] }) {
  return (
    <div className="flex flex-col gap-2">
      {levers.map((lv, i) => (
        <div key={i} className="rounded-lg border border-[var(--line)] bg-white px-3.5 py-3">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[12.5px] font-semibold text-[var(--ink)]">{lv.action}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--accent-50)] text-[var(--accent)]">
              {formatDimension(lv.dimension)}
            </span>
            <span className="text-[10.5px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              ⏱ {lv.deadline}
            </span>
          </div>
          <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed">
            <span className="font-medium text-emerald-700">{lv.expected_effect}.</span> {lv.rationale}
          </p>
          {(lv.evidence_required || lv.material_served) && (
            <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[10.5px] text-[var(--muted)]">
              {lv.evidence_required && <span><span className="font-semibold text-[var(--ink-soft)]">Proof:</span> {lv.evidence_required}</span>}
              {lv.material_served && <span><span className="font-semibold text-[var(--ink-soft)]">Feeds:</span> {lv.material_served}</span>}
            </div>
          )}
        </div>
      ))}
      <p className="text-[10.5px] text-[var(--muted)] mt-0.5">
        Effects are stated as grade movements, not percentage points — nobody can honestly quantify “+3pp”.
      </p>
    </div>
  );
}

/* ── V2: early-round decision matrix + guardrails ─────────── */

const ED_GRADE_STYLE: Record<string, string> = {
  high_leverage: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  limited: 'bg-slate-50 text-slate-600 border-slate-200',
  not_offered: 'bg-slate-50 text-slate-400 border-slate-200',
  not_recommended: 'bg-red-50 text-red-600 border-red-200',
};

function EarlyDecisionMatrix({ v2, student, edEaText, onPlanEd, planningEd }: {
  v2: StrategyV2; student: StudentT; edEaText: string;
  onPlanEd: (schoolId: string | undefined) => void; planningEd: boolean;
}) {
  const evals = v2.evaluations ?? [];
  const withFacts = evals.map(ev => ({ ev, facts: getSchoolFacts(ev.schoolId) }));
  const bindingCandidates = withFacts
    .filter(({ facts }) => facts?.earlyRounds && ['ED', 'ED1_ED2', 'EA_ED'].includes(facts.earlyRounds.value))
    .sort((a, b) => {
      const rank = (g?: string) => ({ high_leverage: 0, moderate: 1, limited: 2 }[g ?? 'limited'] ?? 3);
      return rank(a.facts?.edStrategicValue?.value) - rank(b.facts?.edStrategicValue?.value);
    })
    .slice(0, 3);
  const reaSchools = withFacts.filter(({ facts }) => facts?.earlyRounds?.value === 'REA').map(({ ev }) => ev.short);
  // The (potential) ED pick is excluded from the EA count so ED + EA + RD sums to the list size.
  const edPickId = student.edChoiceId ?? bindingCandidates[0]?.ev.schoolId;
  const eaCount = withFacts.filter(({ ev, facts }) =>
    ev.schoolId !== edPickId && facts?.earlyRounds && ['EA', 'EA_ED', 'REA'].includes(facts.earlyRounds.value)).length;
  const financialFlexible = student.needBasedAid === 'No';

  if (!bindingCandidates.length) return null;

  // Live what-if: rerun the deterministic engine with a hypothetical ED
  // commitment at each candidate. Same rules the next regeneration will use.
  const whatIf = (schoolId: string) => {
    const school = SCHOOLS.find(s => s.id === schoolId);
    if (!school) return null;
    const hypothetical = { ...student, edChoiceId: schoolId };
    return evaluateSchool(hypothetical, extractStudentNumbers(hypothetical), v2.assessment, school);
  };

  const columns = [
    ...bindingCandidates.map(({ ev, facts }) => {
      const sim = whatIf(ev.schoolId);
      return {
        schoolId: ev.schoolId as string | undefined,
        title: `${ev.short} ED`,
        grade: facts?.edStrategicValue?.value ?? 'limited',
        tier: ev.tierLabel,
        ifEd: sim ? `${sim.tierLabel} · ${sim.band.min}–${sim.band.max}%` : '—',
        binding: true,
        conflict: reaSchools.length ? `Blocks REA at ${reaSchools.join(', ')}` : 'None known',
        financial: financialFlexible ? 'OK — no aid comparison needed' : 'Low — binds before comparing aid offers',
      };
    }),
    {
      schoolId: undefined as string | undefined,
      title: 'No binding ED',
      grade: 'not_offered',
      tier: '—',
      ifEd: 'Unchanged — RD/EA tiers as computed',
      binding: false,
      conflict: 'Keeps all EA/REA options open',
      financial: 'Full — compare every aid offer',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 overflow-x-auto">
        <table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)] px-3 py-2" />
              {columns.map(c => {
                const isPlanned = c.schoolId !== undefined
                  ? student.edChoiceId === c.schoolId
                  : student.edChoiceId === undefined;
                return (
                  <th key={c.title} className={`px-3 py-2 border-b border-[var(--line)] ${isPlanned ? 'bg-[var(--accent-50)] rounded-t-lg' : ''}`}>
                    <div className="text-[12.5px] font-bold text-[var(--ink)]">{c.title}</div>
                    <button
                      onClick={() => onPlanEd(c.schoolId)}
                      disabled={planningEd || isPlanned}
                      className={`mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-pill border transition-colors disabled:cursor-default ${
                        isPlanned
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-white text-[var(--ink-soft)] border-[var(--line-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                    >
                      {isPlanned ? '✓ Planned' : c.schoolId ? 'Plan ED here' : 'Keep unbound'}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {([
              ['Strategic leverage', (c: typeof columns[number]) => (
                <span className={`text-[10.5px] font-bold capitalize px-2 py-0.5 rounded-pill border ${ED_GRADE_STYLE[c.grade] ?? ED_GRADE_STYLE.limited}`}>
                  {c.grade === 'not_offered' ? 'n/a' : c.grade.replace(/_/g, ' ')}
                </span>
              )],
              ['Current tier', (c: typeof columns[number]) => <span className="text-[12px] font-semibold text-[var(--ink)]">{c.tier}</span>],
              ['Tier if committed ED', (c: typeof columns[number]) => (
                <span className="text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>{c.ifEd}</span>
              )],
              ['Binding', (c: typeof columns[number]) => (
                <span className={`text-[11.5px] font-semibold ${c.binding ? 'text-red-500' : 'text-emerald-600'}`}>{c.binding ? 'Binding' : 'Non-binding'}</span>
              )],
              ['Other early rounds', (c: typeof columns[number]) => <span className="text-[11.5px] text-[var(--ink-soft)]">{c.conflict}</span>],
              ['Financial flexibility', (c: typeof columns[number]) => <span className="text-[11.5px] text-[var(--ink-soft)]">{c.financial}</span>],
            ] as const).map(([label, render]) => (
              <tr key={label}>
                <td className="text-[11px] font-semibold text-[var(--muted)] px-3 py-2.5 border-b border-[var(--line)] whitespace-nowrap">{label}</td>
                {columns.map(c => (
                  <td key={c.title} className="px-3 py-2.5 border-b border-[var(--line)] align-top">{render(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 rounded-lg bg-[var(--accent-50)] border border-[var(--accent-100)] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-1">Counselor recommendation</div>
          <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{edEaText}</p>
        </div>
        <p className="mt-2 text-[10.5px] text-[var(--muted)]">
          Observed ED admit-rate gaps include selection effects (athletes, legacy, development cases) — leverage grades are judgment, never probability multipliers.
          “Tier if committed ED” is a live preview with current rules; the stored report picks it up on the next regenerate.
        </p>
      </div>

      {/* Round allocation + guardrails */}
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Round Allocation</div>
          <div className="flex gap-2">
            <RoundBox label="ED" n={1} note="binding pick" accent />
            <RoundBox label="EA / REA" n={eaCount} note="non-binding" />
            <RoundBox label="RD" n={Math.max(0, evals.length - 1 - eaCount)} note="regular" />
          </div>
          {evals.length > 12 && (
            <p className="mt-2 text-[11px] text-amber-700 font-medium">⚠ {evals.length} applications — supplement quality and differentiation become the constraint at this volume.</p>
          )}
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2.5">
            <ShieldAlert size={12} /> AI Guardrails
          </div>
          <ul className="flex flex-col gap-2 text-[11.5px] text-[var(--ink-soft)] leading-relaxed">
            <li>· Tiers and ranges come from the deterministic engine — the AI explains them and cannot change them.</li>
            <li>· Every recommendation cites profile evidence; unverified claims are flagged, not polished over.</li>
            <li>· Uncertainty is shown, never hidden: wide bands, confidence labels, and declared unknowns.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function RoundBox({ label, n, note, accent = false }: { label: string; n: number; note: string; accent?: boolean }) {
  return (
    <div className={`flex-1 rounded-lg border px-2.5 py-2 text-center ${accent ? 'border-[var(--accent-100)] bg-[var(--accent-50)]' : 'border-[var(--line)] bg-white'}`}>
      <div className={`text-[17px] font-bold ${accent ? '' : 'text-[var(--ink)]'}`} style={accent ? { color: 'var(--accent)' } : {}}>{n}</div>
      <div className="text-[10px] font-semibold text-[var(--ink-soft)]">{label}</div>
      <div className="text-[9px] text-[var(--muted)]">{note}</div>
    </div>
  );
}

function BandChart({ evaluations }: { evaluations: V2Evaluation[] }) {
  const tierColor = CHART_BUCKET_COLOR;
  const data = [...evaluations]
    .sort((a, b) => (a.band.min + a.band.max) - (b.band.min + b.band.max))
    .map(ev => ({
      name: ev.short,
      tier: ev.uiBucket,
      min: ev.band.min,
      span: ev.band.max - ev.band.min,
      max: ev.band.max,
      label: ev.tierLabel,
    }));

  const truncate = (name: string, max = 26) =>
    name.length > max ? name.slice(0, max - 1) + '…' : name;

  const renderTick = ({ x, y, payload }: { x?: string | number; y?: string | number; payload?: { value?: string | number } }) => (
    <g transform={`translate(${x},${y})`}>
      <title>{payload?.value}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" fontSize={11.5} fill="#334155">
        {truncate(String(payload?.value ?? ''))}
      </text>
    </g>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
          Admit Likelihood Bands <span className="text-[var(--accent)] normal-case tracking-normal font-normal ml-1">— ranges, not point estimates</span>
        </span>
        <div className="flex items-center gap-3">
          {(['reach', 'match', 'safety'] as const).map(t => (
            <div key={t} className="flex items-center gap-1 text-[10.5px] text-[var(--muted)]">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: tierColor[t] }} />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={data.length * 44 + 20}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 80, bottom: 0, left: 0 }}>
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
            tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={170}
            tick={renderTick} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#f8fafc' }}
            formatter={(_v, _n, item) => {
              const d = item.payload;
              return [`${d.label}: ${d.min}–${d.max}%`, 'Likelihood band'];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <Bar dataKey="min" stackId="band" maxBarSize={22} fill="transparent" isAnimationActive={false} />
          <Bar dataKey="span" stackId="band" maxBarSize={22} radius={[4, 4, 4, 4]}>
            {data.map((d, i) => (
              <Cell key={i} fill={tierColor[d.tier]} fillOpacity={0.85} />
            ))}
            <LabelList
              content={(props) => {
                const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                const d = data[index];
                if (!d) return null;
                return (
                  <text x={(x as number) + (width as number) + 6} y={(y as number) + (height as number) / 2 + 4}
                    fontSize={10.5} fontWeight={600} fill="#64748b">
                    {d.min}–{d.max}%
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── JSON repair ──────────────────────────────────────────── */

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

/* ── Page ─────────────────────────────────────────────────── */

export default function StrategyPage() {
  const params = useParams();
  const router = useRouter();
  const { students, strategies, saveStrategy, saveStudentDraft, markDocumentReady } = useApp();
  const studentId = params.studentId as string;
  const student = students.find(s => s.id === studentId);
  const strategy = strategies[studentId] ?? null;
  const v2 = strategy?.v2 ?? null;
  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [leverStates, setLeverStates] = useState<Record<number, LeverState>>({});
  const [planningEd, setPlanningEd] = useState(false);

  const handlePlanEd = async (schoolId: string | undefined) => {
    if (!student || planningEd) return;
    setPlanningEd(true);
    try {
      await saveStudentDraft({ ...student, edChoiceId: schoolId });
    } finally {
      setPlanningEd(false);
    }
  };

  const parsedLevers = useMemo(
    () => (strategy?.meta?.improvement_levers ?? []).map(parseLever),
    [strategy],
  );

  const adjustments = useMemo(
    () => strategy ? computeAdjustments(strategy.schools, parsedLevers, leverStates) : {},
    [strategy, parsedLevers, leverStates],
  );

  const adjustedProb = useMemo(
    () => strategy ? computePortfolioProb(strategy.schools, adjustments) : 0,
    [strategy, adjustments],
  );

  const hasActiveLevers = Object.values(leverStates).some(s => s?.active);

  const handleLeverChange = (i: number, st: LeverState | null) => {
    setLeverStates(prev => {
      const next = { ...prev };
      if (st) next[i] = st; else delete next[i];
      return next;
    });
  };

  const handleGenerate = async (forceRegenerate = false) => {
    if (!student) return;
    setGenerating(true);
    setGenError(null);
    setLoadingStep(0);
    setLeverStates({});
    // Advance the step display while the request runs (real work, not theater)
    const stepTimer = setInterval(() => {
      setLoadingStep(prev => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 9000);
    try {
      const res = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, forceRegenerate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      // Stream response to avoid gateway timeout
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Invalid response from server${fullText.trim() ? `: ${fullText.trim().slice(0, 240)}` : ''}`);
      }
      const rawStrategy: unknown = JSON.parse(repairJson(jsonMatch[0]));
      if (rawStrategy && typeof rawStrategy === 'object' && 'error' in rawStrategy) {
        throw new Error(String(rawStrategy.error));
      }
      const parsed = strategySchema.safeParse(rawStrategy);
      if (!parsed.success) {
        const fields = parsed.error.issues.slice(0, 3).map(issue => issue.path.join('.')).filter(Boolean).join(', ');
        throw new Error(`The AI returned an incomplete strategy${fields ? ` (invalid fields: ${fields})` : ''}. Please regenerate.`);
      }
      const savedOk = await saveStrategy(studentId, parsed.data);
      if (!savedOk) {
        // The server already persisted the strategy before responding — only
        // this window's local copy failed to sync.
        setGenError('The strategy was generated and saved on the server, but this window could not sync its local copy. Reload the page to pick it up.');
      }
    } catch (e) {
      console.warn('Strategy generation failed', e);
      setGenError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      clearInterval(stepTimer);
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    const ok = await markDocumentReady(studentId);
    if (ok) router.push(`/students/${studentId}/documents`);
  };

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  if (generating) {
    return (
      <div className="animate-fade-in">
        <PageHead title="Admissions Strategy" sub={`${student.name} · ${student.school}`} />
        <div className="bg-white rounded-card shadow-card p-16 flex flex-col items-center">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin mb-6" />
          <div className="text-[15px] font-medium text-[var(--ink)] mb-6">Analyzing student profile…</div>
          <div className="flex flex-col gap-2 w-full max-w-sm">
            {LOADING_STEPS.map((s, i) => {
              const done = i < loadingStep, active = i === loadingStep;
              return (
                <div key={i} className={`flex items-center gap-2.5 text-[13px] transition-all ${done ? 'text-[var(--ink)]' : active ? 'text-[var(--accent)]' : 'text-[var(--muted-2)]'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-[var(--accent)]' : active ? 'border border-[var(--accent)]' : 'border border-[var(--line-strong)]'}`}>
                    {done ? <Check size={11} strokeWidth={3} className="text-white" />
                      : active ? <div className="w-2 h-2 rounded-full border border-[var(--accent)] border-t-transparent animate-spin" />
                      : null}
                  </div>
                  {s}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="animate-fade-in">
        <PageHead title="Admissions Strategy" sub={`${student.name} · ${student.school}`}
          actions={
            <button onClick={() => handleGenerate()} className="flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium" style={{ background: 'var(--accent)' }}>
              <Sparkles size={14} /> Generate Strategy
            </button>
          }
        />
        <div className="bg-white rounded-card shadow-card p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-50)] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="text-[16px] font-semibold text-[var(--ink)] mb-2">No strategy generated yet</h3>
          <p className="text-[13px] text-[var(--muted)] mb-6 max-w-xs mx-auto">Run the analysis to produce positioning, school list, and execution plan.</p>
          {genError && (
            <div className="mb-5 mx-auto max-w-sm bg-red-50 border border-red-200 text-red-700 text-[12.5px] rounded-lg px-4 py-3">
              Error: {genError}
            </div>
          )}
          <button onClick={() => handleGenerate()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium" style={{ background: 'var(--accent)' }}>
            <Sparkles size={14} /> Generate Strategy
          </button>
        </div>
      </div>
    );
  }

  const originalProb = parseChance(strategy.meta?.overall_success_probability ?? '0');

  return (
    <div className="animate-fade-in">
      <PageHead
        title="Admissions Strategy"
        sub={`${student.name} · ${student.school} · ${student.major}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => handleGenerate(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded border border-[var(--line-strong)] text-[13.5px] font-medium bg-white hover:bg-[var(--bg-soft)] transition-colors shadow-card">
              <Sparkles size={14} /> Regenerate
            </button>
            <button onClick={handleApprove} className="flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium" style={{ background: 'var(--accent)' }}>
              Approve & Continue <ArrowRight size={14} />
            </button>
          </div>
        }
      />

      {/* ── Meta banner ── */}
      {strategy.meta && (
        <div className="mb-4 rounded-card border border-[var(--accent-100)] bg-[var(--accent-50)] overflow-hidden">
          <div className="flex">
            {/* Gauge */}
            <div className="px-5 py-5 flex flex-col items-center justify-center border-r border-[var(--accent-100)] shrink-0 gap-1">
              <ProbabilityGauge
                value={strategy.meta.overall_success_probability}
                adjusted={!v2 && hasActiveLevers ? adjustedProb : undefined}
                range={v2 ? { min: v2.portfolio.pAtLeastOne.lowerPct, max: v2.portfolio.pAtLeastOne.upperPct } : undefined}
              />
              <div className="text-[9.5px] font-semibold uppercase tracking-widest text-[var(--accent)]">Portfolio Outlook</div>
            </div>
            {/* Content */}
            <div className="flex-1 px-5 py-5 flex flex-col gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-1">
                  <BarChart3 size={11} /> Portfolio Analysis
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {splitAnalysisText(strategy.meta.assessment).slice(0, 4).map((item, i) => (
                    <div key={i} className="rounded-md bg-white/60 border border-[var(--accent-100)] px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
                        {i === 0 ? 'Portfolio Read' : `Point ${i + 1}`}
                      </div>
                      <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shutout risk + coverage (v2 audit) */}
              {v2 && <ShutoutStrip portfolio={v2.portfolio} />}

              {/* Structured improvement levers (v2) — grade movements, no fake pp math */}
              {v2 && v2.levers.length > 0 && (
                <div className="border-t border-[var(--accent-100)] pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-2">
                    <Zap size={11} /> Improvement Levers — deadline-bound actions that move profile grades
                  </div>
                  <V2LeverList levers={v2.levers} />
                </div>
              )}

              {/* Interactive levers (v1 legacy simulator) */}
              {!v2 && parsedLevers.length > 0 && (
                <div className="border-t border-[var(--accent-100)] pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-2">
                    <Zap size={11} /> Simulate Improvements — apply items to preview probability changes
                  </div>
                  <div className="flex flex-col gap-2">
                    {parsedLevers.map((parsed, i) => (
                      <LeverCard
                        key={i}
                        index={i}
                        parsed={parsed}
                        state={leverStates[i]}
                        onChange={handleLeverChange}
                      />
                    ))}
                  </div>
                  {hasActiveLevers && (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--ink-soft)]">
                      <span>Adjusted P(≥1 admit):</span>
                      <span className="font-bold text-emerald-600">{adjustedProb}%</span>
                      {adjustedProb !== originalProb && (
                        <span className={`font-semibold ${adjustedProb > originalProb ? 'text-emerald-500' : 'text-red-400'}`}>
                          ({adjustedProb > originalProb ? '+' : ''}{adjustedProb - originalProb}pp vs baseline)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">

        {/* 01 Positioning */}
        <StratCard num="01" title="Positioning" icon={<User size={16} />}>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">Applicant Type</div>
              <div className="text-[13.5px] font-semibold text-[var(--ink)] leading-snug">{strategy.positioning.type}</div>
            </div>
            <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">Core Identity</div>
              <div className="text-[12px] text-[var(--ink-soft)] leading-relaxed line-clamp-3">{strategy.positioning.identity}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-emerald-600 mb-2">
                <CheckCircle2 size={11} /> Strengths
              </div>
              <div className="flex flex-col gap-1.5">
                {strategy.positioning.strengths.map((item, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />{item}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-amber-600 mb-2">
                <AlertCircle size={11} /> Risks
              </div>
              <div className="flex flex-col gap-1.5">
                {strategy.positioning.weaknesses.map((item, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
                    <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />{item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </StratCard>

        {/* 02 Analysis */}
        {strategy.analysis && (
          <StratCard num="02" title="Profile Analysis" icon={<FlaskConical size={16} />}>
            {v2 && <DimensionGrid assessment={v2.assessment} />}
            <div className="flex flex-col gap-4">
              <AnalysisBlock icon={<Zap size={13} className="text-violet-500" />} label="Spike Assessment" color="violet" text={strategy.analysis.spike_assessment} />
              <AnalysisBlock icon={<BookOpen size={13} className="text-blue-500" />} label="Academic Rigor" color="blue" text={strategy.analysis.academic_rigor} />
              <AnalysisBlock icon={<Eye size={13} className="text-emerald-600" />} label="AO Profile Read" color="emerald" text={strategy.analysis.profile_read} />
              <AnalysisBlock icon={<TriangleAlert size={13} className="text-amber-500" />} label="Key Risks" color="amber" text={strategy.analysis.key_risks} />
            </div>
          </StratCard>
        )}

        {/* 03 Competitiveness */}
        <StratCard num={strategy.analysis ? '03' : '02'} title="Competitiveness" icon={<BarChart2 size={16} />}>
          <CompetitivenessChart comp={strategy.competitiveness} />
          {/* Tier notes */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(['top10', 'top20', 'top50'] as const).map(tier => {
              const { level, note } = strategy.competitiveness[tier];
              const isHigh = level.includes('High'), isMed = level.includes('Medium');
              const bg = isHigh ? 'bg-emerald-50 border-emerald-100' : isMed ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
              const label = tier === 'top10' ? 'Top 10' : tier === 'top20' ? 'Top 20' : 'Top 50';
              return (
                <div key={tier} className={`rounded-lg border p-3 ${bg}`}>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1.5">{label}</div>
                  <p className="text-[11.5px] text-[var(--ink-soft)] leading-relaxed">{note}</p>
                </div>
              );
            })}
          </div>
          <div className="border-t border-[var(--line)] pt-4 flex flex-col gap-1.5">
            {strategy.competitiveness.bullets.map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
                <Target size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />{item}
              </div>
            ))}
          </div>
        </StratCard>

        {/* 04 School List — chart reacts to lever state */}
        <StratCard num={strategy.analysis ? '04' : '03'} title="School List" icon={<GraduationCap size={16} />}>
          {v2
            ? <BandChart evaluations={v2.evaluations} />
            : <SchoolChart schools={strategy.schools} adjustments={adjustments} />}
          <div className="border-t border-[var(--line)] mt-4 pt-4 flex flex-col gap-3">
            {([
              ['reach', 'Reach', strategy.schools.reach, Rocket, 'text-red-500', 'text-red-700 bg-red-50 border-red-100'],
              ['match', 'Match', strategy.schools.match, Target, 'text-amber-500', 'text-amber-700 bg-amber-50 border-amber-100'],
              ['safety', 'Safety', strategy.schools.safety, Shield, 'text-emerald-500', 'text-emerald-700 bg-emerald-50 border-emerald-100'],
            ] as const).map(([key, label, list, Icon, iconColor, badgeColor]) => (
              <div key={key}>
                <div className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-pill mb-2 border ${badgeColor}`}>
                  <Icon size={10} className={iconColor} />{label}
                </div>
                <div className="flex flex-col gap-2">
                  {list.map(s => {
                    const delta = Math.round(adjustments[s.name] ?? 0);
                    const ev = v2?.evaluations.find(e => e.short === s.name || e.schoolName === s.name);
                    return (
                      <div key={s.name} className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3.5 py-2.5">
                        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                          {ev ? (
                            <Link href={`/students/${studentId}/schools/${ev.schoolId}`} className="text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--accent)] hover:underline transition-colors">
                              {s.name}
                            </Link>
                          ) : (
                            <span className="text-[13px] font-semibold text-[var(--ink)]">{s.name}</span>
                          )}
                          <div className="flex items-center gap-1.5">
                            {ev ? (
                              <TierRangeBadge ev={ev} />
                            ) : (
                              <span className="text-[12px] font-bold" style={{ color: 'var(--accent)' }}>{s.chance}</span>
                            )}
                            {!v2 && delta > 0 && <span className="text-[10px] font-bold text-emerald-500">+{delta}pp</span>}
                          </div>
                        </div>
                        {s.note && <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed">{s.note}</p>}
                        {ev && <TraceDisclosure ev={ev} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Engine-suggested additions (not on the student's list) */}
            {v2 && (v2.suggestions?.length ?? 0) > 0 && (
              <div className="mt-1 rounded-lg border border-dashed border-[var(--accent-100)] bg-[var(--accent-50)]/40 p-3.5">
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-1">
                  <Plus size={11} /> Suggested Additions
                </div>
                <p className="text-[11.5px] text-[var(--muted)] mb-2.5">
                  Not on this student&apos;s list — the engine proposes these to patch coverage gaps. Discuss with the family before adding.
                </p>
                <div className="flex flex-col gap-2">
                  {v2.suggestions!.map(ev => (
                    <div key={ev.schoolId} className="rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Link href={`/students/${studentId}/schools/${ev.schoolId}`} className="text-[13px] font-semibold text-[var(--ink)] hover:text-[var(--accent)] hover:underline transition-colors">
                          {ev.short}
                        </Link>
                        <TierRangeBadge ev={ev} />
                      </div>
                      <TraceDisclosure ev={ev} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </StratCard>

        {/* 05 Strategy */}
        <StratCard num={strategy.analysis ? '05' : '04'} title="Application Strategy" icon={<Lightbulb size={16} />}>
          {v2 ? (
            <div className="flex flex-col gap-5">
              <EarlyDecisionMatrix v2={v2} student={student} edEaText={strategy.strategy.ed_ea} onPlanEd={handlePlanEd} planningEd={planningEd} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NarrativeCard text={strategy.strategy.narrative} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <EdEaPlan text={strategy.strategy.ed_ea} />
              <NarrativeCard text={strategy.strategy.narrative} />
            </div>
          )}
        </StratCard>

        {/* 06 Plan */}
        <StratCard num={strategy.analysis ? '06' : '05'} title="Execution Plan" icon={<ListTodo size={16} />}>
          <ExecutionTimeline plan={strategy.plan} />
        </StratCard>

      </div>
    </div>
  );
}

/* ── ED/EA Plan ───────────────────────────────────────────── */

function EdEaPlan({ text }: { text: string }) {
  const parts = text.split(/\.\s+/).filter(Boolean).map((s, i, arr) => i < arr.length - 1 ? s + '.' : s);
  const headline = parts.slice(0, 2).join(' ');
  const bullets = parts.slice(2);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <CalendarDays size={14} className="text-amber-600" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">ED / EA Decision</span>
      </div>
      <p className="text-[13.5px] font-semibold text-[var(--ink)] leading-snug">{headline}</p>
      {bullets.length > 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-amber-200">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] text-amber-900">
              <ChevronRight size={13} className="shrink-0 mt-0.5 text-amber-500" />
              <span className="leading-relaxed">{b}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Narrative Direction ──────────────────────────────────── */

function NarrativeCard({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const parts = text.split(/\.\s+/).filter(Boolean).map((s, i, arr) => i < arr.length - 1 ? s + '.' : s);
  const pullQuote = parts[0] ?? text;
  const bullets = parts.slice(1);
  const visible = expanded ? bullets : bullets.slice(0, 3);

  return (
    <div className="rounded-xl border border-[var(--accent-100)] bg-white p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[var(--accent-50)] flex items-center justify-center shrink-0">
          <PenLine size={14} style={{ color: 'var(--accent)' }} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">Narrative Direction</span>
      </div>
      {/* Pull quote */}
      <div className="rounded-lg bg-[var(--accent-50)] border-l-4 border-[var(--accent)] px-4 py-3">
        <Quote size={13} style={{ color: 'var(--accent)' }} className="mb-1.5 opacity-60" />
        <p className="text-[13px] font-semibold text-[var(--ink)] leading-relaxed italic">{pullQuote}</p>
      </div>
      {/* Bullets */}
      {bullets.length > 0 && (
        <div className="flex flex-col gap-2">
          {visible.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] text-[var(--ink-soft)]">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--accent)' }} />
              <span className="leading-relaxed">{b}</span>
            </div>
          ))}
          {bullets.length > 3 && (
            <button
              onClick={() => setExpanded(p => !p)}
              className="text-[12px] font-medium mt-0.5 text-left flex items-center gap-1"
              style={{ color: 'var(--accent)' }}
            >
              <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Show less' : `${bullets.length - 3} more points`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Execution Timeline ───────────────────────────────────── */

function ExecutionTimeline({ plan }: { plan: Array<{ month: string; tasks: string }> }) {
  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set([0]));

  const toggle = (i: number) =>
    setOpenSet(prev => {
      const n = new Set(prev);
      if (n.has(i)) {
        n.delete(i);
      } else {
        n.add(i);
      }
      return n;
    });

  return (
    <div className="relative pl-2">
      {/* Vertical rail */}
      <div className="absolute left-[27px] top-5 bottom-5 w-px bg-[var(--line)]" />

      <div className="flex flex-col">
        {plan.map((row, i) => {
          const isOpen = openSet.has(i);
          const tasks = row.tasks.split(/\.\s+/).filter(Boolean).map((s, j, arr) => j < arr.length - 1 ? s + '.' : s);
          const isLast = i === plan.length - 1;

          return (
            <div
              key={i}
              className="flex gap-4"
              style={{ animation: `fadeSlideUp 0.35s ease both`, animationDelay: `${i * 60}ms` }}
            >
              {/* Timeline dot */}
              <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 transition-colors ${
                isOpen
                  ? 'bg-white border-[var(--accent)]'
                  : 'bg-[var(--bg-soft)] border-[var(--line-strong)]'
              }`}>
                <CalendarDays size={14} className={isOpen ? '' : 'text-[var(--muted)]'} style={isOpen ? { color: 'var(--accent)' } : {}} />
              </div>

              {/* Content */}
              <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                <button
                  onClick={() => toggle(i)}
                  className="flex items-center gap-2 w-full text-left py-1.5 group"
                >
                  <span className={`text-[13.5px] font-bold transition-colors ${isOpen ? '' : 'text-[var(--ink-soft)] group-hover:text-[var(--ink)]'}`}
                    style={isOpen ? { color: 'var(--accent)' } : {}}>
                    {row.month}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`text-[var(--muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                  {!isOpen && (
                    <span className="text-[11.5px] text-[var(--muted)] truncate flex-1">{tasks[0]}</span>
                  )}
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-2 pb-1">
                    {tasks.map((task, j) => (
                      <div
                        key={j}
                        className="flex items-start gap-2.5 text-[12.5px] text-[var(--ink-soft)] leading-relaxed"
                        style={{ animation: `fadeSlideUp 0.25s ease both`, animationDelay: `${j * 40}ms` }}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold text-white"
                          style={{ background: 'var(--accent)', opacity: 0.85 }}
                        >
                          {j + 1}
                        </div>
                        {task}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Shared ───────────────────────────────────────────────── */

function PageHead({ title, sub, actions }: { title: string; sub: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--ink)]">{title}</h1>
        <p className="text-[var(--muted)] mt-1">{sub}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function cleanStrategyText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/\*\*/g, '')
    .trim();
}

function splitAnalysisText(text: string): string[] {
  const cleaned = cleanStrategyText(text);
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+(?=(?:[A-Z0-9]|Risk\s+\d+|[([]\d+))|;\s+(?=(?:[A-Z0-9]|Risk\s+\d+))/g)
    .map(part => part.trim())
    .filter(Boolean);
}

function AnalysisBlock({ icon, label, color, text }: { icon: React.ReactNode; label: string; color: string; text: string }) {
  const bg: Record<string, string> = {
    violet: 'bg-violet-50 border-violet-100',
    blue: 'bg-blue-50 border-blue-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    amber: 'bg-amber-50 border-amber-100',
  };
  const labelColor: Record<string, string> = {
    violet: 'text-violet-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  };
  const parts = splitAnalysisText(text);
  const headline = parts[0] ?? 'No analysis returned.';
  const details = parts.slice(1, 7);
  const isRisk = color === 'amber';
  const detailLabel = isRisk ? 'Watch Items' : 'Evidence';

  return (
    <div className={`rounded-lg border p-4 ${bg[color] ?? 'bg-[var(--bg-soft)] border-[var(--line)]'}`}>
      <div className={`flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest mb-3 ${labelColor[color] ?? 'text-[var(--muted)]'}`}>
        {icon}{label}
      </div>
      <div className="rounded-md bg-white/70 border border-white/80 px-3 py-2.5 mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
          Main Read
        </div>
        <p className="text-[13.5px] font-semibold text-[var(--ink)] leading-relaxed">{headline}</p>
      </div>
      {details.length > 0 && (
        <div>
          <div className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${labelColor[color] ?? 'text-[var(--muted)]'}`}>
            {detailLabel}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {details.map((item, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-white/60 border border-white/70 px-3 py-2">
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${isRisk ? 'bg-amber-500' : 'bg-[var(--accent)]'}`} />
                <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StratCard({ num, title, icon, children }: { num: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-6 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent-50)] flex items-center justify-center" style={{ color: 'var(--accent)' }}>
            {icon}
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
        </div>
        <span className="text-[11px] font-bold text-[var(--muted)] tabular-nums">{num}</span>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

