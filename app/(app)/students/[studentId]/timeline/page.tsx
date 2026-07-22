'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Sparkles, ArrowRight, Star, CircleCheck, Circle, TriangleAlert,
  FileText, Users, PenLine, GraduationCap, Banknote, Send, FolderCheck, ListChecks,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageHeader, Chip, PrimaryButton, EmptyState } from '@/components/ui';
import { TASK_MATERIALS, deriveTimelineTasks, parsePlanMonth } from '@/lib/timelineTasks';

/* ── Task derivation (stable content-hash ids, shared with the route) ── */

interface DerivedTask {
  id: string;
  month: string;
  monthDate: Date | null;
  text: string;
  material: string;
}

const MATERIAL_ICONS: Record<string, typeof FileText> = {
  personal_statement: PenLine,
  supplements: FileText,
  recommendations: Users,
  testing: GraduationCap,
  financial: Banknote,
  submission: Send,
  evidence: FolderCheck,
};

const MATERIALS = TASK_MATERIALS.map(m => ({ ...m, Icon: MATERIAL_ICONS[m.key] ?? FolderCheck }));

/* ── Page ─────────────────────────────────────────────────── */

export default function TimelinePage() {
  const params = useParams();
  const { students, strategies, saveStudentDraft } = useApp();
  const studentId = params.studentId as string;
  const student = students.find(s => s.id === studentId);
  const strategy = strategies[studentId] ?? null;
  const [saving, setSaving] = useState(false);

  // Prefer the generation-time stable-id tasks; older strategies fall back to
  // the identical derivation (same lib → same content-hash ids).
  const tasks = useMemo((): DerivedTask[] => {
    if (!strategy) return [];
    const source = strategy.v2?.planTasks ?? deriveTimelineTasks(strategy.plan);
    return source.map(t => ({ ...t, monthDate: parsePlanMonth(t.month) }));
  }, [strategy]);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  if (!strategy) {
    return (
      <div className="animate-fade-in max-w-[1080px] mx-auto">
        <PageHeader title="Timeline" sub={`${student.name} · deadline-driven execution plan`} />
        <EmptyState
          icon={<Sparkles size={24} />}
          title="No execution plan yet"
          body="The timeline is derived from the strategy's deadline-driven plan."
          action={<PrimaryButton href={`/students/${studentId}/strategy`}>Generate a strategy <ArrowRight size={14} /></PrimaryButton>}
        />
      </div>
    );
  }

  const checks = student.timelineChecks ?? {};
  const done = tasks.filter(t => checks[t.id]).length;
  const now = new Date();
  const monthStatus = (t: DerivedTask): 'done' | 'overdue' | 'due' | 'upcoming' => {
    if (checks[t.id]) return 'done';
    if (!t.monthDate) return 'upcoming';
    const end = new Date(t.monthDate.getFullYear(), t.monthDate.getMonth() + 1, 0);
    if (end < now) return 'overdue';
    if (t.monthDate.getMonth() === now.getMonth() && t.monthDate.getFullYear() === now.getFullYear()) return 'due';
    return 'upcoming';
  };
  const overdue = tasks.filter(t => monthStatus(t) === 'overdue').length;
  const due = tasks.filter(t => monthStatus(t) === 'due').length;

  const toggle = async (taskId: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await saveStudentDraft({ ...student, timelineChecks: { ...checks, [taskId]: !checks[taskId] } });
    } finally {
      setSaving(false);
    }
  };

  const months = strategy.plan.map(p => p.month);

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <PageHeader
        title="Timeline"
        sub={`${student.name} · deadline-driven execution plan`}
        actions={tasks.length > 0 ? <Chip tone="accent">{done} of {tasks.length} tasks complete</Chip> : undefined}
      />

      {/* Milestone strip */}
      <div className="bg-white rounded-card shadow-card px-6 py-4 mb-4 overflow-x-auto">
        <div className="flex items-start min-w-[640px]">
          {months.map((m, i) => {
            const critical = /nov/i.test(m) || /jan/i.test(m);
            const monthTasks = tasks.filter(t => t.month === m);
            const monthDone = monthTasks.filter(t => checks[t.id]).length;
            return (
              <div key={m} className="flex-1 relative">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full shrink-0 z-10 ${
                    monthDone === monthTasks.length && monthTasks.length > 0 ? 'bg-emerald-500'
                    : critical ? 'bg-[var(--accent)] ring-4 ring-[var(--accent-50)]' : 'bg-slate-300'
                  }`} />
                  {i < months.length - 1 && <div className="flex-1 h-px bg-[var(--line-strong)]" />}
                </div>
                <div className={`mt-2 text-[11px] font-bold flex items-center gap-1 ${critical ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>
                  {critical && <Star size={10} fill="currentColor" />}{m}
                </div>
                <div className="text-[10px] text-[var(--muted)]">{monthDone}/{monthTasks.length} done</div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10.5px] text-[var(--muted)]">★ ED/EA deadline Nov 1 · RD deadline Jan 1</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task list by month */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {strategy.plan.map(row => {
            const monthTasks = tasks.filter(t => t.month === row.month);
            return (
              <section key={row.month} className="bg-white rounded-card shadow-card overflow-hidden">
                <div className="px-5 py-2.5 border-b border-[var(--line)] flex items-center justify-between">
                  <h2 className="text-[13.5px] font-bold text-[var(--ink)]">{row.month}</h2>
                  <span className="text-[11px] text-[var(--muted)]">{monthTasks.filter(t => checks[t.id]).length}/{monthTasks.length}</span>
                </div>
                <div className="px-4 py-2.5 flex flex-col">
                  {monthTasks.map(t => {
                    const status = monthStatus(t);
                    const mat = MATERIALS.find(m => m.key === t.material);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggle(t.id)}
                        disabled={saving}
                        className="flex items-start gap-2.5 px-1.5 py-2 rounded-lg text-left hover:bg-[var(--bg-soft)] transition-colors disabled:opacity-60"
                      >
                        {status === 'done'
                          ? <CircleCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                          : <Circle size={16} className={`shrink-0 mt-0.5 ${status === 'overdue' ? 'text-red-400' : 'text-slate-300'}`} />}
                        <span className={`text-[12.5px] leading-relaxed ${status === 'done' ? 'text-[var(--muted)] line-through' : 'text-[var(--ink-soft)]'}`}>
                          {t.text}
                        </span>
                        <span className="ml-auto shrink-0 flex items-center gap-1.5 mt-0.5">
                          {status === 'overdue' && <span className="text-[9.5px] font-bold text-red-500 border border-red-200 bg-red-50 rounded px-1 py-0.5">OVERDUE</span>}
                          {mat && <span className="text-[9.5px] font-semibold text-[var(--muted)] border border-[var(--line)] bg-[var(--bg-soft)] rounded px-1 py-0.5">{mat.label}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <section className="bg-white rounded-card shadow-card px-5 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <TriangleAlert size={14} className={overdue ? 'text-red-500' : 'text-[var(--muted)]'} />
              <h2 className="text-[14px] font-semibold text-[var(--ink)]">Deadline Risk</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <RiskStat label="Done" value={done} color="#059669" />
              <RiskStat label="Overdue" value={overdue} color={overdue ? '#dc2626' : '#94a3b8'} />
              <RiskStat label="This month" value={due} color="#d97706" />
            </div>
            {overdue > 0 && (
              <p className="mt-3 text-[11.5px] text-red-600 leading-relaxed">
                {overdue} task{overdue > 1 ? 's are' : ' is'} past {overdue > 1 ? 'their' : 'its'} planned month — clear or re-plan before the next deadline window.
              </p>
            )}
          </section>

          <section className="bg-white rounded-card shadow-card px-5 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <ListChecks size={14} className="text-[var(--muted)]" />
              <h2 className="text-[14px] font-semibold text-[var(--ink)]">Material Readiness</h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {MATERIALS.map(m => {
                const matTasks = tasks.filter(t => t.material === m.key);
                if (!matTasks.length) return null;
                const matDone = matTasks.filter(t => checks[t.id]).length;
                const pct = Math.round((matDone / matTasks.length) * 100);
                const Icon = m.Icon;
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink)]"><Icon size={12} className="text-[var(--muted)]" />{m.label}</span>
                      <span className="text-[11px] font-bold text-[var(--ink-soft)]">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-soft)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : 'var(--accent)' }} />
                    </div>
                    <div className="text-[10px] text-[var(--muted)] mt-0.5">{matDone} of {matTasks.length} tasks</div>
                  </div>
                );
              })}
            </div>
          </section>

          <p className="text-[10.5px] text-[var(--muted)] px-1 leading-relaxed">
            Tasks are derived from the strategy&apos;s execution plan; check-offs are saved with the student. Regenerating the strategy re-derives the list — completed items may need re-checking if the plan changes.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────── */

function RiskStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-2 py-2 text-center">
      <div className="text-[17px] font-bold" style={{ color }}>{value}</div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
    </div>
  );
}
