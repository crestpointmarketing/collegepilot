'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Printer, Download, FileSpreadsheet, File } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageHeader, AlertCard, GhostButton, Chip, PrimaryButton } from '@/components/ui';
import { CHAR_LIMITS } from '@/lib/characterLimits';
import type { Activity, Award, Strategy, Student } from '@/types';

/* ── Export helpers (merged from the former Downloads page) ── */

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentsPage() {
  const params = useParams();
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
  const hasStrategy = !!strategy;

  /* Generated downloads */
  const handleCSV = () => {
    if (!strategy) return;
    const rows: string[][] = [
      ['Category', 'School', 'Admit Probability', 'Notes'],
      ...strategy.schools.reach.map((s: { name: string; chance: string; note?: string }) => ['Reach', s.name, s.chance, s.note ?? '']),
      ...strategy.schools.match.map((s: { name: string; chance: string; note?: string }) => ['Match', s.name, s.chance, s.note ?? '']),
      ...strategy.schools.safety.map((s: { name: string; chance: string; note?: string }) => ['Safety', s.name, s.chance, s.note ?? '']),
    ];
    downloadCSV(`${student.name.replace(/\s+/g, '_')}_school_list.csv`, rows);
  };

  const handleTxt = () => {
    const lines: string[] = [
      `COMMON APP — ACTIVITIES & HONORS`,
      `${student.name} · ${student.school} · ${student.major}`,
      '', `ACTIVITIES (${acts.length}/10)`, '─'.repeat(60),
    ];
    acts.forEach((a, i) => {
      lines.push('', `${i + 1}. ${a.position} — ${a.org}`,
        `   Category: ${a.category}  |  ${a.timing}  |  ${a.hours} hrs/wk × ${a.weeks} wks/yr`,
        `   ${a.desc}`, `   (${(a.desc ?? '').length}/150 characters)`);
    });
    lines.push('', `HONORS & AWARDS (${awards.length}/5)`, '─'.repeat(60));
    awards.forEach((aw, i) => lines.push(`${i + 1}. ${aw.title}  |  ${aw.level}  |  Grade ${aw.grade}`));
    downloadText(`${student.name.replace(/\s+/g, '_')}_common_app.txt`, lines.join('\n'));
  };

  const schoolCount = (strategy?.schools.reach.length ?? 0) + (strategy?.schools.match.length ?? 0) + (strategy?.schools.safety.length ?? 0);
  const downloads = [
    { icon: Printer, title: 'Strategy Report', desc: 'Full positioning, school list, and execution plan. Opens the print dialog (Save as PDF).', format: 'PDF', size: 'via browser', enabled: hasStrategy, onDownload: () => window.print() },
    { icon: FileSpreadsheet, title: 'School List', desc: 'Reach / Match / Safety schools with admit probabilities for tracking.', format: 'CSV', size: `${schoolCount} schools`, enabled: hasStrategy, onDownload: handleCSV },
    { icon: File, title: 'Common App Entries', desc: 'Activities and honors formatted for Common App word limits.', format: 'TXT', size: `${acts.length} activities`, enabled: (student.activities?.length ?? 0) > 0, onDownload: handleTxt },
  ];

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <PageHeader
        title="Documents & Downloads"
        sub={`Preview Common App–ready content and export strategy assets for ${student.name}.`}
        actions={<GhostButton onClick={() => window.print()}><Printer size={14} /> Print / Save PDF</GhostButton>}
      />

      {/* View toggle */}
      <div className="flex gap-2 mb-5 no-print">
        {[
          { key: 'strategy' as const, label: 'Full Strategy Report' },
          { key: 'commonapp' as const, label: 'Common App Version' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setView(opt.key)}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold border transition-colors ${
              view === opt.key
                ? 'bg-[var(--accent)] text-white border-transparent'
                : 'bg-white border-[var(--line-strong)] text-[var(--muted)] hover:bg-[var(--bg-soft)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Overflow warning */}
      {hasOverflow && (
        <div className="mb-5">
          <AlertCard tone="warning" title="Common App limits applied"
            body={`Showing top 10 activities (${student.activities?.length ?? 0} entered) and top 5 honors (${student.awards?.length ?? 0} entered).`} />
        </div>
      )}

      {/* Document preview */}
      <div className="bg-white rounded-card shadow-card border border-[var(--line)] p-8 animate-slide-in" key={view}>
        {view === 'strategy' ? (
          <StrategyDoc student={student} strategy={strategy} />
        ) : (
          <CommonAppDoc student={student} acts={acts} awards={awards} />
        )}
      </div>

      {/* ── Generated Downloads (merged from the former Downloads page) ── */}
      <div className="mt-8 no-print">
        <h2 className="text-[16px] font-bold text-[var(--ink)] mb-1">Generated Downloads</h2>
        <p className="text-[13px] text-[var(--muted)] mb-4">Export the strategy and Common App materials above.</p>

        {!hasStrategy && (
          <div className="mb-4">
            <AlertCard tone="warning" title="No strategy yet" body="Generate a strategy first to enable the PDF and CSV exports." />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {downloads.map(d => {
            const Icon = d.icon;
            return (
              <div key={d.title} className={`bg-white rounded-xl border border-[var(--line)] shadow-card p-5 flex flex-col gap-4 ${!d.enabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-50)] flex items-center justify-center shrink-0">
                    <Icon size={19} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="text-right">
                    <Chip tone="neutral">{d.format}</Chip>
                    <div className="text-[11px] text-[var(--muted-2)] mt-1">{d.size}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-[var(--ink)] mb-1">{d.title}</div>
                  <p className="text-[13px] text-[var(--muted)] leading-relaxed">{d.desc}</p>
                </div>
                <button
                  disabled={!d.enabled}
                  onClick={d.onDownload}
                  className="mt-auto flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-[var(--line-strong)] text-[13.5px] font-semibold text-[var(--ink)] bg-white hover:bg-[var(--bg-soft)] transition-colors disabled:cursor-not-allowed"
                >
                  <Download size={14} /> Download
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 bg-white rounded-xl border border-[var(--line)] shadow-card p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[14px] font-semibold text-[var(--ink)]">Download everything</div>
            <div className="text-[13px] text-[var(--muted)] mt-0.5">CSV school list + Common App entries.</div>
          </div>
          <PrimaryButton onClick={() => { handleCSV(); handleTxt(); }} className={!hasStrategy ? 'opacity-50 pointer-events-none' : ''}>
            <Download size={14} /> Download All
          </PrimaryButton>
        </div>
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

function StrategyDoc({ student, strategy }: { student: Student; strategy: Strategy | null }) {
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
          <DocP><strong>Reach.</strong> {strategy.schools.reach.map(s => `${s.name} (${s.chance})`).join(', ')}</DocP>
          <DocP><strong>Match.</strong> {strategy.schools.match.map(s => `${s.name} (${s.chance})`).join(', ')}</DocP>
          <DocP><strong>Safety.</strong> {strategy.schools.safety.map(s => `${s.name} (${s.chance})`).join(', ')}</DocP>

          <DocH2>Execution Plan</DocH2>
          {strategy.plan.map((row, i) => (
            <DocP key={i}><strong>{row.month}.</strong> {row.tasks}</DocP>
          ))}
        </>
      )}
    </div>
  );
}

function CommonAppDoc({ student, acts, awards }: { student: Student; acts: Activity[]; awards: Award[] }) {
  return (
    <div className="max-w-2xl">
      <DocH1>Common App — Activities & Honors</DocH1>
      <DocSub>{student.name} · {student.school} · {student.major}</DocSub>

      <DocH2>Activities ({acts.length}/10)</DocH2>
      {acts.length === 0 && <DocP>No activities entered yet.</DocP>}
      {acts.map((a, i) => (
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
      {awards.map((aw, i) => (
        <div key={aw.id ?? i} className="flex items-center justify-between py-2 border-b border-[var(--line)] last:border-0">
          <div className="text-[13.5px] text-[var(--ink)]">{aw.title}</div>
          <div className="text-[12px] text-[var(--muted)] shrink-0 ml-4">{aw.level} · Grade {aw.grade}</div>
        </div>
      ))}
    </div>
  );
}
