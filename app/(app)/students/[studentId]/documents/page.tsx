'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Printer, Download, FileSpreadsheet, File, ScrollText, ArrowRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageHeader, AlertCard, GhostButton, Chip, PrimaryButton } from '@/components/ui';
import { CHAR_LIMITS } from '@/lib/characterLimits';
import type { Activity, Award, Strategy, Student } from '@/types';

/* ── Export helpers ── */

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

/** First sentence of a prose field — keeps the preview to core points. */
function firstSentence(text: string | undefined): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  const m = t.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : t).trim();
}

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const { students, strategies, blueprints } = useApp();
  const studentId = params.studentId as string;

  const student = students.find(s => s.id === studentId);
  const strategy = strategies[studentId] ?? null;
  const blueprint = blueprints[studentId] ?? null;

  const [view, setView] = useState<'strategy' | 'commonapp'>('strategy');
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('print') === '1') {
      setTimeout(() => window.print(), 600);
    }
  }, [searchParams]);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  const firstName = student.name.split(' ')[0];
  const acts = (student.activities ?? []).slice(0, 10);
  const awards = (student.awards ?? []).slice(0, 5);
  const hasOverflow = (student.activities?.length ?? 0) > 10 || (student.awards?.length ?? 0) > 5;
  const hasStrategy = !!strategy;

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
  const secondaryDownloads = [
    { icon: Printer, title: 'Strategy Summary', desc: 'This one-page summary. Opens the print dialog (Save as PDF).', format: 'PDF', size: 'this page', enabled: hasStrategy, onDownload: () => window.print() },
    { icon: FileSpreadsheet, title: 'School List', desc: 'Reach / Match / Safety with admit probabilities.', format: 'CSV', size: `${schoolCount} schools`, enabled: hasStrategy, onDownload: handleCSV },
    { icon: File, title: 'Common App Entries', desc: 'Activities and honors within Common App limits.', format: 'TXT', size: `${acts.length} activities`, enabled: (student.activities?.length ?? 0) > 0, onDownload: handleTxt },
  ];

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <PageHeader
        title="Documents & Downloads"
        sub={`A one-page summary for ${student.name} — full detail lives in the Blueprint Journey™.`}
        actions={<GhostButton onClick={() => window.print()}><Printer size={14} /> Print / Save PDF</GhostButton>}
      />

      {/* Hero: the Blueprint is the complete document */}
      <div className="mb-6 rounded-card border border-[var(--accent-100)] bg-[var(--accent-50)] p-6 flex items-center justify-between gap-4 flex-wrap no-print">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-card">
            <ScrollText size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-bold text-[var(--ink)]">Blueprint Journey™{blueprint ? ` · ${blueprint.draftLabel}` : ''}</div>
            <p className="text-[13px] text-[var(--muted)] mt-0.5 leading-relaxed max-w-xl">
              The complete six-volume strategy book — identity, evidence, positioning, program fit, and narrative for {firstName} in one document. This is the deliverable to download and share.
            </p>
          </div>
        </div>
        {blueprint ? (
          <PrimaryButton onClick={() => router.push(`/students/${studentId}/blueprint?print=1`)}>
            <Download size={15} /> Download Blueprint PDF
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => router.push(`/students/${studentId}/blueprint`)}>
            Build the Blueprint <ArrowRight size={15} />
          </PrimaryButton>
        )}
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-5 no-print">
        {[
          { key: 'strategy' as const, label: 'Strategy Summary' },
          { key: 'commonapp' as const, label: 'Common App Entries' },
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

      {view === 'commonapp' && hasOverflow && (
        <div className="mb-5">
          <AlertCard tone="warning" title="Common App limits applied"
            body={`Showing top 10 activities (${student.activities?.length ?? 0} entered) and top 5 honors (${student.awards?.length ?? 0} entered).`} />
        </div>
      )}

      {/* Preview — concise */}
      <div className="bg-white rounded-card shadow-card border border-[var(--line)] p-8 animate-slide-in" key={view}>
        {view === 'strategy' ? (
          <StrategySummary student={student} strategy={strategy} firstName={firstName} />
        ) : (
          <CommonAppDoc student={student} acts={acts} awards={awards} />
        )}
      </div>

      {/* Secondary exports */}
      <div className="mt-8 no-print">
        <h2 className="text-[15px] font-bold text-[var(--ink)] mb-1">Also available</h2>
        <p className="text-[13px] text-[var(--muted)] mb-4">Lightweight exports for tracking and the Common App.</p>

        {!hasStrategy && (
          <div className="mb-4">
            <AlertCard tone="warning" title="No strategy yet" body="Generate a strategy first to enable these exports." />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {secondaryDownloads.map(d => {
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
      </div>
    </div>
  );
}

/* ── Concise strategy summary — core answers only ── */

function SumRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-[var(--line)] last:border-0">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-1">{label}</div>
      <div className="text-[14px] text-[var(--ink)] leading-relaxed">{children}</div>
    </div>
  );
}

function StrategySummary({ student, strategy, firstName }: { student: Student; strategy: Strategy | null; firstName: string }) {
  if (!strategy) {
    return (
      <div className="text-center py-6">
        <p className="text-[14px] text-[var(--muted)]">No strategy generated yet. Generate one to see the summary here.</p>
      </div>
    );
  }
  const v2 = strategy.v2 ?? null;
  const outlook = v2
    ? `${v2.portfolio.pAtLeastOne.lowerPct}–${v2.portfolio.pAtLeastOne.upperPct}% chance of at least one admit`
    : (strategy.meta?.overall_success_probability ?? '—');
  const comp = strategy.competitiveness;
  const tierNames = (list: { name: string }[]) => list.map(s => s.name).join(', ');

  return (
    <div className="max-w-2xl">
      <div className="text-[22px] font-bold text-[var(--ink)] tracking-tight">Strategy Summary</div>
      <div className="text-[13px] text-[var(--muted)] mb-5">{student.name} · {student.school} · {student.major}</div>

      <SumRow label="Applicant Type">{strategy.positioning.type}</SumRow>
      <SumRow label={`Who is ${firstName}?`}>{firstSentence(strategy.positioning.identity)}</SumRow>
      <SumRow label="Portfolio Outlook">{outlook}</SumRow>
      {comp && (
        <SumRow label="Competitiveness">
          <span className="inline-flex flex-wrap gap-2">
            <Chip tone="neutral">Top 10: {comp.top10.level}</Chip>
            <Chip tone="neutral">Top 20: {comp.top20.level}</Chip>
            <Chip tone="neutral">Top 50: {comp.top50.level}</Chip>
          </span>
        </SumRow>
      )}
      <SumRow label={`School List (${strategy.schools.reach.length + strategy.schools.match.length + strategy.schools.safety.length})`}>
        <div className="flex flex-col gap-1 text-[13px]">
          {strategy.schools.reach.length > 0 && <div><span className="font-semibold text-[#B91C1C]">Reach:</span> {tierNames(strategy.schools.reach)}</div>}
          {strategy.schools.match.length > 0 && <div><span className="font-semibold text-[var(--accent)]">Match:</span> {tierNames(strategy.schools.match)}</div>}
          {strategy.schools.safety.length > 0 && <div><span className="font-semibold text-[#15803D]">Safety:</span> {tierNames(strategy.schools.safety)}</div>}
        </div>
      </SumRow>
      <SumRow label="Early Round (ED/EA)">{firstSentence(strategy.strategy.ed_ea)}</SumRow>

      <div className="mt-5 rounded-lg bg-[var(--accent-50)] border border-[var(--accent-100)] px-4 py-3 text-[12.5px] text-[var(--ink-soft)] leading-relaxed">
        This is the short version. The full reasoning, evidence labels, and the complete six volumes live in the <span className="font-semibold text-[var(--accent)]">Blueprint Journey™</span> — download it above.
      </div>
    </div>
  );
}

function DocH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[16px] font-bold text-[var(--ink)] mt-7 mb-3 pb-2 border-b border-[var(--line)] first:mt-0">{children}</h2>;
}
function DocSub({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] text-[var(--muted)] mb-6">{children}</div>;
}
function DocP({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed mb-3">{children}</p>;
}

function CommonAppDoc({ student, acts, awards }: { student: Student; acts: Activity[]; awards: Award[] }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-[22px] font-bold text-[var(--ink)] tracking-tight mb-1">Common App — Activities & Honors</h1>
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
