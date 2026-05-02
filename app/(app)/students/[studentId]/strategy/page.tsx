'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, LabelList,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { LOADING_STEPS } from '@/lib/data';
import type { Strategy } from '@/types';

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

function ProbabilityGauge({ value, adjusted }: { value: string; adjusted?: number }) {
  const original = parseChance(value);
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
        <path d={arcPath(display)} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>{display}%</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize={9} fill="#94a3b8" letterSpacing={0.5}>P(≥1 ADMIT)</text>
      </svg>
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
  lever, parsed, state, index,
  onChange,
}: {
  lever: string; parsed: ParsedLever; state?: LeverState; index: number;
  onChange: (i: number, st: LeverState | null) => void;
}) {
  const active = state?.active ?? false;
  const strength = state?.strength ?? 1;

  return (
    <div className={`rounded-lg border transition-all ${active ? 'border-[var(--accent)] bg-white shadow-sm' : 'border-[var(--line)] bg-[var(--bg-soft)]'}`}>
      {/* Header row */}
      <div className="flex items-start gap-2.5 p-3">
        <button
          onClick={() => onChange(index, active ? null : { active: true, strength: 1 })}
          className={`w-5 h-5 rounded shrink-0 flex items-center justify-center mt-0.5 transition-colors ${active ? 'text-white' : 'border border-[var(--line-strong)] hover:border-[var(--accent)]'}`}
          style={active ? { background: 'var(--accent)' } : {}}
        >
          {active ? <Check size={11} strokeWidth={3} /> : <Plus size={11} className="text-[var(--muted)]" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-[12.5px] font-semibold leading-snug ${active ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}>
            {parsed.action}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
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
  const tierColor: Record<string, string> = { reach: '#f87171', match: '#fbbf24', safety: '#34d399' };
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

  const CustomTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => (
    <g transform={`translate(${x},${y})`}>
      <title>{payload?.value}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" fontSize={11.5} fill="#334155">
        {truncate(payload?.value ?? '')}
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
            tick={<CustomTick />} axisLine={false} tickLine={false} />
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

/* ── Page ─────────────────────────────────────────────────── */

export default function StrategyPage() {
  const params = useParams();
  const router = useRouter();
  const { students, strategies, saveStrategy, markDocumentReady } = useApp();
  const studentId = params.studentId as string;
  const student = students.find(s => s.id === studentId);
  const strategy = strategies[studentId] ?? null;
  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [leverStates, setLeverStates] = useState<Record<number, LeverState>>({});

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
    for (let i = 0; i < LOADING_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 700 + Math.random() * 400));
      setLoadingStep(i + 1);
    }
    try {
      const res = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student, forceRegenerate }),
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
      if (!jsonMatch) throw new Error('Invalid response from server');
      // Sanitize literal newlines/tabs inside JSON string values
      const sanitize = (s: string) =>
        s.replace(/"(?:[^"\\]|\\.)*"/g, m =>
          m.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ')
        );
      let parsed;
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch { parsed = JSON.parse(sanitize(jsonMatch[0])); }
      saveStrategy(studentId, parsed);
    } catch (e) {
      console.warn('Strategy generation failed', e);
      setGenError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = () => {
    markDocumentReady(studentId);
    router.push(`/students/${studentId}/documents`);
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
                adjusted={hasActiveLevers ? adjustedProb : undefined}
              />
              <div className="text-[9.5px] font-semibold uppercase tracking-widest text-[var(--accent)]">Portfolio Score</div>
            </div>
            {/* Content */}
            <div className="flex-1 px-5 py-5 flex flex-col gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-1">
                  <BarChart3 size={11} /> Portfolio Analysis
                </div>
                <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{strategy.meta.assessment}</p>
              </div>

              {/* Interactive levers */}
              {parsedLevers.length > 0 && (
                <div className="border-t border-[var(--accent-100)] pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-2">
                    <Zap size={11} /> Simulate Improvements — toggle to see impact on school probabilities
                  </div>
                  <div className="flex flex-col gap-2">
                    {parsedLevers.map((parsed, i) => (
                      <LeverCard
                        key={i}
                        index={i}
                        lever={strategy.meta!.improvement_levers[i]}
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

        {/* 02 Competitiveness */}
        <StratCard num="02" title="Competitiveness" icon={<BarChart2 size={16} />}>
          <CompetitivenessChart comp={strategy.competitiveness} />
          <div className="border-t border-[var(--line)] pt-4 flex flex-col gap-1.5">
            {strategy.competitiveness.bullets.map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
                <Target size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />{item}
              </div>
            ))}
          </div>
        </StratCard>

        {/* 03 School List — chart reacts to lever state */}
        <StratCard num="03" title="School List" icon={<GraduationCap size={16} />}>
          <SchoolChart schools={strategy.schools} adjustments={adjustments} />
          <div className="border-t border-[var(--line)] mt-4 pt-4">
            {([
              ['reach', 'Reach', strategy.schools.reach, Rocket, 'text-red-500', 'text-red-700 bg-red-50'],
              ['match', 'Match', strategy.schools.match, Target, 'text-amber-500', 'text-amber-700 bg-amber-50'],
              ['safety', 'Safety', strategy.schools.safety, Shield, 'text-emerald-500', 'text-emerald-700 bg-emerald-50'],
            ] as const).map(([key, label, list, Icon, iconColor, badgeColor]) => (
              <div key={key} className="flex items-start gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
                <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-pill shrink-0 mt-0.5 ${badgeColor}`}>
                  <Icon size={10} className={iconColor} />{label}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.map(s => {
                    const delta = Math.round(adjustments[s.name] ?? 0);
                    return (
                      <span key={s.name} className="inline-flex items-center gap-1 bg-[var(--bg-soft)] border border-[var(--line)] px-2 py-0.5 rounded-pill text-[11.5px] font-medium text-[var(--ink)]">
                        {s.name}
                        <span className="text-[10.5px] text-[var(--muted)]">{s.chance}</span>
                        {delta > 0 && (
                          <span className="text-[10px] font-bold text-emerald-500">+{delta}pp</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </StratCard>

        {/* 04 Strategy */}
        <StratCard num="04" title="Application Strategy" icon={<Lightbulb size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <EdEaPlan text={strategy.strategy.ed_ea} />
            <NarrativeCard text={strategy.strategy.narrative} />
          </div>
        </StratCard>

        {/* 05 Plan */}
        <StratCard num="05" title="Execution Plan" icon={<ListTodo size={16} />}>
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
    setOpenSet(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

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
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        <p className="text-[var(--muted)] mt-1">{sub}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
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
        <span className="text-[11px] font-bold text-[var(--muted)] tabular-nums">{num} / 05</span>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
