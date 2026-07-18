/**
 * Execution-plan task derivation, shared by the strategy route (which stamps
 * stable ids into v2.planTasks at generation time) and the Timeline page
 * (fallback for older strategies — same code, same ids).
 *
 * Ids are content hashes of the normalized task text, NOT positions: a task
 * keeps its id when the plan is reordered or unrelated tasks change, and a
 * rewritten task is honestly a new task.
 */

import type { PlanTask, Strategy } from '@/types';

export const TASK_MATERIALS: { key: string; label: string; test: RegExp }[] = [
  { key: 'personal_statement', label: 'Personal Statement', test: /personal statement|main essay|common app essay/i },
  { key: 'supplements', label: 'Supplemental Essays', test: /supplement|why (major|school|us)|school-specific essay/i },
  { key: 'recommendations', label: 'Recommendations', test: /recommend|rec letter|counselor letter|teacher/i },
  { key: 'testing', label: 'Testing & Transcript', test: /\bsat\b|\bact\b|score|transcript|registrar|endorsement/i },
  { key: 'financial', label: 'Financial Aid', test: /fafsa|css|financial|aid|net price|scholarship/i },
  { key: 'submission', label: 'Submission & QA', test: /submit|proofread|qa|final review|deadline|application fee/i },
  { key: 'evidence', label: 'Profile & Evidence', test: /verif|demo|github|portfolio|project|link|evidence|documentation/i },
];

export function classifyMaterial(text: string): string {
  for (const m of TASK_MATERIALS) if (m.test.test(text)) return m.key;
  return 'evidence';
}

/** djb2 over normalized text — tiny, deterministic, dependency-free. */
function contentHash(text: string): string {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  let h = 5381;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) + h + normalized.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export function deriveTimelineTasks(plan: Strategy['plan']): PlanTask[] {
  const seen = new Map<string, number>();
  return plan.flatMap(row => {
    const parts = row.tasks.split(/(?<=[.;])\s+/).map(s => s.trim()).filter(s => s.length > 4);
    return parts.map(text => {
      const base = `t${contentHash(text)}`;
      // Disambiguate identical texts (rare) by occurrence index — still stable.
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return {
        id: n === 0 ? base : `${base}-${n}`,
        month: row.month,
        text: text.replace(/[;.]$/, '.'),
        material: classifyMaterial(text),
      };
    });
  });
}

// Match by 3-letter prefix so "Nov 2026", "Sept 2026" and "November 2026" all parse.
const MONTH_PREFIXES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parsePlanMonth(label: string): Date | null {
  const m = label.toLowerCase().match(new RegExp(`\\b(${MONTH_PREFIXES.join('|')})[a-z]*\\.?\\s+(\\d{4})`));
  if (!m) return null;
  return new Date(parseInt(m[2]), MONTH_PREFIXES.indexOf(m[1]), 1);
}
