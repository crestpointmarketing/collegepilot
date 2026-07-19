'use client';

/**
 * Admission Intelligence Center — the student-bound view of a single school.
 * Match + Strategy are local, deterministic (no API). AO Perspective is one
 * small LLM call. Deep Research (Perplexity) stays in the parent page.
 */

import { useMemo, useState } from 'react';
import {
  Sparkles, Target, Compass, GraduationCap, ShieldCheck, TriangleAlert,
  CircleHelp, CalendarClock, PenLine, ClipboardList, Eye, ArrowRight, Loader2,
} from 'lucide-react';
import type { School, Student, StrategyV2 } from '@/types';
import { computeApplicationStrategy, computeSchoolMatch, type FitLevel } from '@/lib/admissions/schoolMatch';

const FIT_STYLE: Record<FitLevel, { bar: string; chip: string }> = {
  Excellent: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Strong: { bar: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700 border-teal-200' },
  Moderate: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  Limited: { bar: 'bg-red-400', chip: 'bg-red-50 text-red-600 border-red-200' },
  Unknown: { bar: 'bg-slate-300', chip: 'bg-slate-50 text-slate-500 border-slate-200' },
};
// Rated levels fill 2–5 dots; Unknown is NOT a low score — it renders as a
// distinct dashed "not measured" row so missing data never reads as "bad fit".
const FIT_FILL: Record<Exclude<FitLevel, 'Unknown'>, number> = { Excellent: 5, Strong: 4, Moderate: 3, Limited: 2 };

function FitDots({ level }: { level: FitLevel }) {
  if (level === 'Unknown') {
    return (
      <div className="flex gap-1" title="Not measured — missing input, not a low score">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className="w-2 h-2 rounded-full border border-dashed border-slate-300" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full ${i <= FIT_FILL[level] ? FIT_STYLE[level].bar : 'bg-slate-200'}`} />
      ))}
    </div>
  );
}

function FitChip({ level }: { level: FitLevel }) {
  return <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-pill border ${FIT_STYLE[level].chip}`}>{level}</span>;
}

export function IntelligenceCenter({ student, school, v2, studentId }: {
  student: Student; school: School; v2: StrategyV2 | null; studentId: string;
}) {
  const assessment = v2?.assessment;

  const match = useMemo(
    () => (assessment ? computeSchoolMatch(student, school, assessment) : null),
    [student, school, assessment],
  );
  const strategy = useMemo(
    () => (assessment && match ? computeApplicationStrategy(student, school, assessment, match) : null),
    [student, school, assessment, match],
  );

  const [ao, setAo] = useState<string | null>(null);
  const [aoLoading, setAoLoading] = useState(false);
  const [aoError, setAoError] = useState('');

  const runAo = async () => {
    setAoLoading(true); setAoError('');
    try {
      const res = await fetch('/api/ao-perspective', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, schoolId: school.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setAo(data.perspective);
    } catch (e) {
      setAoError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setAoLoading(false);
    }
  };

  if (!assessment || !match || !strategy) {
    return (
      <div className="bg-white border border-[var(--line)] rounded-xl p-10 text-center">
        <div className="w-11 h-11 rounded-full bg-[var(--accent-50)] flex items-center justify-center mx-auto mb-3">
          <Sparkles size={18} style={{ color: 'var(--accent)' }} />
        </div>
        <h3 className="text-[15px] font-semibold text-[var(--ink)] mb-1">Match analysis needs a strategy first</h3>
        <p className="text-[13px] text-[var(--muted)] max-w-sm mx-auto">
          Match, Strategy, and AO Perspective are computed from {student.name}&apos;s profile assessment. Generate a strategy to unlock them.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Overall match banner */}
      <div className="rounded-xl border border-[var(--accent-100)] bg-[var(--accent-50)] p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)] mb-1">Overall Match</div>
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-bold text-[var(--ink)]">{match.overall}</span>
              <FitDots level={match.overall} />
            </div>
          </div>
          <p className="flex-1 min-w-[240px] text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{match.overallRationale}</p>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">Admission Difficulty</div>
            <div className="text-[13px] font-bold text-[var(--ink)]">{match.admissionBand.min}–{match.admissionBand.max}%</div>
          </div>
        </div>
      </div>

      {/* Fit axes */}
      <Card icon={<Target size={14} />} title="Fit Breakdown" sub="qualitative — grounded in profile evidence, not a scored index">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {match.axes.map(axis => (
            <div key={axis.key} className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12.5px] font-semibold text-[var(--ink)]">{axis.label}</span>
                <FitChip level={axis.level} />
              </div>
              <p className="text-[11.5px] text-[var(--muted)] leading-relaxed">{axis.rationale}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Strengths & weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card icon={<ShieldCheck size={14} className="text-emerald-600" />} title="Strength Alignment">
          {match.strengths.length ? (
            <div className="flex flex-col gap-2">
              {match.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <FitChip level={s.level} />
                  <div className="min-w-0">
                    <span className="text-[12.5px] font-semibold text-[var(--ink)]">{s.label}</span>
                    <p className="text-[11.5px] text-[var(--muted)] leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-[12px] text-[var(--muted)]">No verified standout strengths for this school yet.</p>}
        </Card>
        <Card icon={<TriangleAlert size={14} className="text-amber-500" />} title="Gaps to Close">
          {match.weaknesses.length ? (
            <div className="flex flex-col gap-2">
              {match.weaknesses.map((w, i) => (
                <div key={i} className="rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2">
                  <span className="text-[12px] font-semibold text-amber-800">{w.label}</span>
                  <p className="text-[11.5px] text-[var(--ink-soft)] leading-relaxed">{w.detail}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-[12px] text-[var(--muted)]">No blocking gaps flagged for this school.</p>}
        </Card>
      </div>

      {/* Suggested majors */}
      <Card icon={<GraduationCap size={14} />} title="Suggested Majors" sub="ranked by fit to this student's demonstrated preparation">
        <div className="flex flex-col gap-2">
          {match.majorRecommendations.slice(0, 5).map((m, i) => (
            <div key={m.major} className="flex items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2.5">
              <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[var(--ink)]">{m.major}</span>
                  <FitChip level={m.fit} />
                  {m.gated && <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">Gated</span>}
                </div>
                <p className="text-[11.5px] text-[var(--muted)] leading-relaxed mt-0.5">{m.reason}</p>
                {m.caution && <p className="text-[11px] text-red-600 mt-0.5">⚠ {m.caution}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Application strategy */}
      <Card icon={<Compass size={14} />} title="Best Application Strategy">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] p-3.5 flex flex-col gap-2.5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <CalendarClock size={13} className="text-[var(--accent)]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Recommended Round</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-[var(--ink)]">{strategy.recommendedRound}</span>
                <FitChip level={strategy.roundStrength} />
              </div>
              <p className="text-[11.5px] text-[var(--muted)] leading-relaxed mt-1">{strategy.roundRationale}</p>
            </div>
            <div className="border-t border-[var(--line)] pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Suggested Major</span>
              <p className="text-[12.5px] font-semibold text-[var(--ink)]">{strategy.suggestedMajor}
                {strategy.alternativeMajor && <span className="font-normal text-[var(--muted)]"> · alt: {strategy.alternativeMajor}</span>}
              </p>
              {strategy.avoid && <p className="text-[11.5px] text-red-600 mt-0.5">Avoid: {strategy.avoid}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5"><PenLine size={13} className="text-[var(--accent)]" /><span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Essay Angles</span></div>
              <ul className="flex flex-col gap-1">
                {strategy.essayAngles.map((e, i) => <li key={i} className="text-[12px] text-[var(--ink-soft)] leading-relaxed">· {e}</li>)}
              </ul>
            </div>
            {strategy.materialGaps.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5"><ClipboardList size={13} className="text-amber-500" /><span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Materials to Strengthen</span></div>
                <ul className="flex flex-col gap-1">
                  {strategy.materialGaps.map((g, i) => <li key={i} className="text-[12px] text-[var(--ink-soft)] leading-relaxed">· {g}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* AO Perspective */}
      <Card icon={<Eye size={14} />} title="Admissions Officer Perspective" sub="AI simulation of a first read — not a real committee decision">
        {ao ? (
          <p className="text-[13px] text-[var(--ink)] leading-relaxed italic">{ao}</p>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-[12.5px] text-[var(--muted)]">Simulate how a {school.short} admissions reader would first-read {student.name}.</p>
            <button onClick={runAo} disabled={aoLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {aoLoading ? <><Loader2 size={14} className="animate-spin" /> Reading…</> : <>Simulate first read <ArrowRight size={13} /></>}
            </button>
            {aoError && <p className="text-[12px] text-red-600">{aoError}</p>}
          </div>
        )}
        {ao && (
          <div className="mt-3 flex items-start gap-1.5 text-[11px] text-[var(--muted)]">
            <CircleHelp size={12} className="shrink-0 mt-0.5" />
            <span>This is an AI simulation grounded in the profile, not a prediction of the real office&apos;s decision.</span>
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[var(--line)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--accent)]">{icon}</span>
        <div>
          <h3 className="text-[14px] font-bold text-[var(--ink)] leading-tight">{title}</h3>
          {sub && <p className="text-[11px] text-[var(--muted)]">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
