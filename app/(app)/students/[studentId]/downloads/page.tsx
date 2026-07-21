'use client';

import { useParams, useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, File, Printer } from 'lucide-react';
import { useApp } from '@/context/AppContext';

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

export default function DownloadsPage() {
  const params = useParams();
  const router = useRouter();
  const { students, strategies } = useApp();
  const studentId = params.studentId as string;
  const student = students.find(s => s.id === studentId);
  const strategy = strategies[studentId] ?? null;

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  const hasStrategy = !!strategy;

  const handlePDF = () => {
    router.push(`/students/${studentId}/documents?print=1`);
  };

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
    const acts = (student.activities ?? []).slice(0, 10);
    const awards = (student.awards ?? []).slice(0, 5);

    const lines: string[] = [
      `COMMON APP — ACTIVITIES & HONORS`,
      `${student.name} · ${student.school} · ${student.major}`,
      '',
      `ACTIVITIES (${acts.length}/10)`,
      '─'.repeat(60),
    ];

    acts.forEach((a, i) => {
      lines.push(
        ``,
        `${i + 1}. ${a.position} — ${a.org}`,
        `   Category: ${a.category}  |  ${a.timing}  |  ${a.hours} hrs/wk × ${a.weeks} wks/yr`,
        `   ${a.desc}`,
        `   (${(a.desc ?? '').length}/150 characters)`,
      );
    });

    lines.push('', `HONORS & AWARDS (${awards.length}/5)`, '─'.repeat(60));
    awards.forEach((aw, i) => {
      lines.push(`${i + 1}. ${aw.title}  |  ${aw.level}  |  Grade ${aw.grade}`);
    });

    downloadText(`${student.name.replace(/\s+/g, '_')}_common_app.txt`, lines.join('\n'));
  };

  const downloads = [
    {
      icon: Printer,
      title: 'Strategy Report',
      desc: 'Full positioning, school list, application strategy, and execution plan. Opens print dialog.',
      format: 'PDF',
      size: 'via browser',
      enabled: hasStrategy,
      onDownload: handlePDF,
    },
    {
      icon: FileSpreadsheet,
      title: 'School List',
      desc: 'Reach / Match / Safety schools with admit probabilities for easy tracking.',
      format: 'CSV',
      size: `${(strategy?.schools.reach.length ?? 0) + (strategy?.schools.match.length ?? 0) + (strategy?.schools.safety.length ?? 0)} schools`,
      enabled: hasStrategy,
      onDownload: handleCSV,
    },
    {
      icon: File,
      title: 'Common App Entries',
      desc: 'Activities list and honors list formatted for Common App word limits.',
      format: 'TXT',
      size: `${(student.activities ?? []).slice(0, 10).length} activities`,
      enabled: (student.activities?.length ?? 0) > 0,
      onDownload: handleTxt,
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[26px] font-bold tracking-tight text-[var(--ink)]">Downloads</h1>
        <p className="text-[var(--muted)] mt-1">Export strategy and Common App materials for {student.name}.</p>
      </div>

      {!hasStrategy && (
        <div className="mb-6 p-4 rounded-card border border-amber-200 bg-amber-50 text-[13.5px] text-amber-800">
          Generate a strategy first to enable PDF and CSV downloads.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {downloads.map(d => {
          const Icon = d.icon;
          return (
            <div key={d.title} className={`bg-white rounded-card shadow-card p-6 flex flex-col gap-4 ${!d.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-50)] flex items-center justify-center">
                  <Icon size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">{d.format}</div>
                  <div className="text-[12px] text-[var(--muted-2)]">{d.size}</div>
                </div>
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[var(--ink)] mb-1">{d.title}</div>
                <p className="text-[13px] text-[var(--muted)] leading-relaxed">{d.desc}</p>
              </div>
              <button
                disabled={!d.enabled}
                onClick={d.onDownload}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded border border-[var(--line-strong)] text-[13.5px] font-medium text-[var(--ink)] bg-white hover:bg-[var(--bg-soft)] transition-colors shadow-card mt-auto disabled:cursor-not-allowed"
              >
                <Download size={14} /> Download
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-white rounded-card shadow-card p-5 flex items-center justify-between">
        <div>
          <div className="text-[14px] font-semibold text-[var(--ink)]">Download everything</div>
          <div className="text-[13px] text-[var(--muted)] mt-0.5">CSV school list + Common App entries.</div>
        </div>
        <button
          disabled={!hasStrategy}
          onClick={() => { handleCSV(); handleTxt(); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)' }}
        >
          <Download size={14} /> Download All
        </button>
      </div>
    </div>
  );
}
