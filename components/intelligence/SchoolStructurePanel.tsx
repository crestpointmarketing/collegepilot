'use client';

/**
 * School Structure tree + Program Reputation. Both are school-intrinsic — they
 * do NOT need the student's assessment, so they render even before a strategy
 * exists. Reputation shows only the sourced overall rank + a qualitative tier;
 * never a fabricated program-rank number.
 */

import { useState } from 'react';
import { Building2, ChevronRight, Award, Info } from 'lucide-react';
import type { School } from '@/types';
import { buildSchoolStructure, deriveProgramReputation, type ReputationTier } from '@/lib/admissions/schoolStructure';

const TIER_STYLE: Record<ReputationTier, string> = {
  'Nationally Recognized': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Strong: 'bg-teal-50 text-teal-700 border-teal-200',
  Solid: 'bg-amber-50 text-amber-700 border-amber-200',
  Emerging: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function SchoolStructurePanel({ school, field }: { school: School; field: string }) {
  const structure = buildSchoolStructure(school);
  const reputation = deriveProgramReputation(school, field);
  const fieldLower = field.toLowerCase().split('/')[0].trim();
  // Expand the college most relevant to the student's field by default.
  const relevantIdx = structure.colleges.findIndex(c =>
    c.departments.some(d => d.name.toLowerCase().includes(fieldLower) || /computer|comput|cs\b/i.test(d.name)),
  );
  const [open, setOpen] = useState<Set<number>>(() => new Set(relevantIdx >= 0 ? [relevantIdx] : [0]));

  const toggle = (i: number) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Structure tree */}
      <div className="lg:col-span-3 bg-white border border-[var(--line)] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={14} className="text-[var(--accent)]" />
          <h3 className="text-[14px] font-bold text-[var(--ink)]">School Structure</h3>
        </div>
        <p className="text-[11px] text-[var(--muted)] mb-3">
          {structure.confidence === 'high' ? 'College → department → program' : 'Majors offered (structure not yet detailed)'}
        </p>
        <div className="flex flex-col gap-1">
          {structure.colleges.map((college, i) => {
            const expanded = open.has(i);
            const hasChildren = college.departments.some(d => d.name || d.programs.length);
            return (
              <div key={college.name} className="rounded-lg border border-[var(--line)] overflow-hidden">
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg-soft)] transition-colors"
                >
                  <ChevronRight size={13} className={`text-[var(--muted)] transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  <span className="text-[13px] font-semibold text-[var(--ink)]">{college.name}</span>
                </button>
                {expanded && hasChildren && (
                  <div className="px-3 pb-2.5 pl-8 flex flex-col gap-2">
                    {college.departments.map(dept => (
                      <div key={dept.name}>
                        <div className="text-[12px] font-medium text-[var(--ink-soft)]">{dept.name}</div>
                        {dept.programs.length > 0 && (
                          <ul className="mt-1 flex flex-col gap-1 pl-3 border-l border-[var(--line)]">
                            {dept.programs.map(p => (
                              <li key={p.name} className="text-[11.5px] text-[var(--muted)]">
                                {p.name}
                                {p.note && <span className="text-[10.5px] text-[var(--muted-2)]"> — {p.note}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[10.5px] text-[var(--muted)]">
          <Info size={11} className="shrink-0 mt-0.5" />{structure.note}
        </p>
      </div>

      {/* Program reputation */}
      <div className="lg:col-span-2 bg-white border border-[var(--line)] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Award size={14} className="text-[var(--accent)]" />
          <h3 className="text-[14px] font-bold text-[var(--ink)]">Program Reputation</h3>
        </div>
        <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] p-3 mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{field} standing</div>
          <span className={`inline-flex text-[11.5px] font-bold px-2.5 py-1 rounded-pill border ${TIER_STYLE[reputation.fieldTier]}`}>
            {reputation.fieldTier}
          </span>
        </div>
        <div className="text-[12px] text-[var(--ink-soft)] mb-2">{reputation.overallRankingNote}</div>
        <div className="flex flex-col gap-1.5 mb-3">
          {reputation.signals.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11.5px] text-[var(--muted)] leading-relaxed">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-[var(--accent)] shrink-0" />{s}
            </div>
          ))}
        </div>
        <p className="flex items-start gap-1.5 text-[10.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
          <Info size={11} className="shrink-0 mt-0.5" />{reputation.disclaimer}
        </p>
      </div>
    </div>
  );
}
