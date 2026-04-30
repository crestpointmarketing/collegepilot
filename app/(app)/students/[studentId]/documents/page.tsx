'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, FileText, Printer } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { CHAR_LIMITS } from '@/lib/characterLimits';

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const { students, strategies } = useApp();
  const studentId = params.studentId as string;

  const student = students.find(s => s.id === studentId);
  const strategy = strategies[studentId] ?? null;

  const [view, setView] = useState<'strategy' | 'commonapp'>('strategy');
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('print') === '1') {
      setTimeout(() => window.print(), 600);
    }
  }, [searchParams]);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  const acts = (student.activities ?? []).slice(0, 10);
  const awards = (student.awards ?? []).slice(0, 5);

  const hasOverflow = (student.activities?.length ?? 0) > 10 || (student.awards?.length ?? 0) > 5;

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">Generate Documents</h1>
          <p className="text-[var(--muted)] mt-1">Preview and export Common App–ready content for {student.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded border border-[var(--line-strong)] text-[13.5px] font-medium bg-white hover:bg-[var(--bg-soft)] transition-colors shadow-card"
          >
            <Printer size={14} /> Print / Save PDF
          </button>
          <button
            onClick={() => router.push(`/students/${studentId}/downloads`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium"
            style={{ background: 'var(--accent)' }}
          >
            Go to Downloads <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'strategy' as const, label: 'Full Strategy Report' },
          { key: 'commonapp' as const, label: 'Common App Version' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setView(opt.key)}
            className={`px-4 py-2 rounded text-[13.5px] font-medium border transition-all ${
              view === opt.key
                ? 'text-white border-transparent'
                : 'bg-white border-[var(--line-strong)] text-[var(--ink-soft)] hover:bg-[var(--bg-soft)]'
            }`}
            style={view === opt.key ? { background: 'var(--accent)' } : {}}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Overflow warning */}
      {hasOverflow && (
        <div className="mb-5 p-4 rounded-card border border-[var(--amber-600)] bg-[var(--amber-50)] flex items-start gap-3">
          <span className="text-[var(--amber-600)]">⚠</span>
          <div className="text-[13px] text-[var(--amber-600)]">
            <strong>Common App limits applied.</strong> Showing top 10 activities ({student.activities?.length ?? 0} entered) and top 5 honors ({student.awards?.length ?? 0} entered).
          </div>
        </div>
      )}

      {/* Document preview */}
      <div className="bg-white rounded-card shadow-card p-8 animate-slide-in" key={view}>
        {view === 'strategy' ? (
          <StrategyDoc student={student} strategy={strategy} />
        ) : (
          <CommonAppDoc student={student} acts={acts} awards={awards} />
        )}
      </div>
    </div>
  );
}

function DocH1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[24px] font-bold text-[var(--ink)] mb-1">{children}</h1>;
}
function DocH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[16px] font-bold text-[var(--ink)] mt-7 mb-3 pb-2 border-b border-[var(--line)]">{children}</h2>;
}
function DocSub({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] text-[var(--muted)] mb-6">{children}</div>;
}
function DocP({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-3">{children}</p>;
}

function StrategyDoc({ student, strategy }: { student: any; strategy: any }) {
  return (
    <div className="max-w-2xl">
      <DocH1>Admissions Strategy</DocH1>
      <DocSub>Prepared for {student.name} · {student.school} · {student.major}</DocSub>

      <DocH2>Student Overview</DocH2>
      <DocP>
        {student.name} is a Grade {student.grade} student at {student.school} ({student.city}),
        pursuing {student.major}{student.secondary && ` with a secondary interest in ${student.secondary}`}.
        Academic profile: GPA {student.gpa} ({student.gpaType}); SAT {student.sat || '—'};
        {student.apCount} AP/IB courses. Citizenship: {student.citizenship || '—'};
        school type: {student.schoolType}; first-generation: {student.firstGen}.
      </DocP>

      {strategy && (
        <>
          <DocH2>Strategy Summary</DocH2>
          <DocP><strong>Applicant Type.</strong> {strategy.positioning.type}</DocP>
          <DocP><strong>Core Identity.</strong> {strategy.positioning.identity}</DocP>
          <DocP><strong>ED / EA Plan.</strong> {strategy.strategy.ed_ea}</DocP>
          <DocP><strong>Narrative.</strong> {strategy.strategy.narrative}</DocP>

          <DocH2>School List</DocH2>
          <DocP><strong>Reach.</strong> {strategy.schools.reach.map((s: any) => `${s.name} (${s.chance})`).join(', ')}</DocP>
          <DocP><strong>Match.</strong> {strategy.schools.match.map((s: any) => `${s.name} (${s.chance})`).join(', ')}</DocP>
          <DocP><strong>Safety.</strong> {strategy.schools.safety.map((s: any) => `${s.name} (${s.chance})`).join(', ')}</DocP>

          <DocH2>Execution Plan</DocH2>
          {strategy.plan.map((row: any, i: number) => (
            <DocP key={i}><strong>{row.month}.</strong> {row.tasks}</DocP>
          ))}
        </>
      )}
    </div>
  );
}

function CommonAppDoc({ student, acts, awards }: { student: any; acts: any[]; awards: any[] }) {
  return (
    <div className="max-w-2xl">
      <DocH1>Common App — Activities & Honors</DocH1>
      <DocSub>{student.name} · {student.school} · {student.major}</DocSub>

      <DocH2>Activities ({acts.length}/10)</DocH2>
      {acts.length === 0 && <DocP>No activities entered yet.</DocP>}
      {acts.map((a: any, i: number) => (
        <div key={a.id ?? i} className="mb-5 pb-5 border-b border-[var(--line)] last:border-0">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[14px] font-semibold text-[var(--ink)]">
              {i + 1}. {a.position} — {a.org}
            </div>
            <span className="text-[11px] text-[var(--muted)] bg-[var(--bg-soft)] px-2 py-0.5 rounded">{a.category}</span>
          </div>
          <div className="text-[12px] text-[var(--muted)] mb-1.5">
            {a.timing} · {a.hours} hrs/wk × {a.weeks} wks/yr
          </div>
          <div className="text-[13.5px] text-[var(--ink-soft)] leading-relaxed">{a.desc}</div>
          <div className="flex justify-between mt-1">
            <span />
            <span className={`text-[11.5px] tabular-nums ${(a.desc?.length ?? 0) > CHAR_LIMITS.activityDesc ? 'text-red-600 font-bold' : 'text-[var(--muted)]'}`}>
              {a.desc?.length ?? 0}/{CHAR_LIMITS.activityDesc}
            </span>
          </div>
        </div>
      ))}

      <DocH2>Honors & Awards ({awards.length}/5)</DocH2>
      {awards.length === 0 && <DocP>No awards entered yet.</DocP>}
      {awards.map((aw: any, i: number) => (
        <div key={aw.id ?? i} className="flex items-center justify-between py-2 border-b border-[var(--line)] last:border-0">
          <div className="text-[13.5px] text-[var(--ink)]">{aw.title}</div>
          <div className="text-[12px] text-[var(--muted)] shrink-0 ml-4">{aw.level} · Grade {aw.grade}</div>
        </div>
      ))}
    </div>
  );
}
