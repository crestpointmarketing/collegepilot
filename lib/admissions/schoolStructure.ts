/**
 * School Structure + Program Reputation.
 *
 * TWO honesty rules, hard:
 *  1. Structure is REAL org data (College → Department → Program) for the
 *     schools we've verified; every other school degrades to a flattened
 *     major list explicitly labeled "not yet detailed — verify on the
 *     official site". We never invent a college/department hierarchy.
 *  2. Reputation is QUALITATIVE, never a fabricated program ranking. The only
 *     number is the school's overall US News rank (already in schools.ts,
 *     sourced). Field standing is a tier word derived from observable signals
 *     (topRanked, published highlights, CS admit-rate gating) with an explicit
 *     "not an official program ranking" disclaimer.
 */

import type { School } from '@/types';
import { getSchoolFacts } from './schoolFacts';

/* ── Structure types ───────────────────────────────────────── */

export interface StructureProgram {
  name: string;
  /** e.g. "concentration within CS, not a separate major" */
  note?: string;
}
export interface StructureDepartment {
  name: string;
  programs: StructureProgram[];
}
export interface StructureCollege {
  name: string;
  departments: StructureDepartment[];
}
export interface SchoolStructure {
  schoolId: string;
  colleges: StructureCollege[];
  /** high = hand-verified hierarchy; low = flattened from the major list. */
  confidence: 'high' | 'low';
  note: string;
}

// Concentration-vs-major caveat reused across CS entries.
const CONC = 'research/concentration area, typically declared within CS — not a separate undergraduate major';

/**
 * Hand-verified structures for CS/engineering-relevant flagships. Kept
 * deliberately to the colleges and departments a CS/AI applicant navigates;
 * "Other colleges" collects the rest without pretending to enumerate them.
 */
const VERIFIED_STRUCTURE: Record<string, StructureCollege[]> = {
  cmu: [
    {
      name: 'School of Computer Science (SCS)',
      departments: [
        { name: 'Computer Science Department', programs: [
          { name: 'Computer Science (BS)' },
          { name: 'Artificial Intelligence (BS in AI)' },
          { name: 'Machine Learning', note: CONC },
          { name: 'Systems', note: CONC },
        ] },
        { name: 'Robotics Institute', programs: [{ name: 'Robotics', note: 'primarily graduate/research; undergrad via CS minors and research' }] },
        { name: 'Human-Computer Interaction Institute', programs: [{ name: 'HCI (additional major)' }] },
        { name: 'Language Technologies Institute', programs: [{ name: 'Computational Linguistics / NLP', note: 'primarily graduate' }] },
      ],
    },
    {
      name: 'College of Engineering (CIT)',
      departments: [
        { name: 'Electrical & Computer Engineering', programs: [{ name: 'ECE (BS)' }, { name: 'Computer Architecture', note: CONC }, { name: 'Embedded Systems', note: CONC }] },
        { name: 'Mechanical Engineering', programs: [{ name: 'Mechanical Engineering (BS)' }] },
      ],
    },
    { name: 'Other colleges', departments: [{ name: 'Tepper (Business), Dietrich (H&SS), Mellon (Science), Fine Arts, Heinz', programs: [] }] },
  ],
  cornell: [
    {
      name: 'Cornell Bowers College of Computing & Information Science',
      departments: [
        { name: 'Computer Science', programs: [{ name: 'Computer Science (BS/BA)', note: 'offered jointly through both Engineering and Arts & Sciences' }, { name: 'Artificial Intelligence', note: CONC }, { name: 'Robotics', note: CONC }] },
        { name: 'Information Science', programs: [{ name: 'Information Science (BS)' }] },
        { name: 'Statistics & Data Science', programs: [{ name: 'Statistical Science' }] },
      ],
    },
    {
      name: 'College of Engineering',
      departments: [
        { name: 'Electrical & Computer Engineering', programs: [{ name: 'ECE (BS)' }] },
        { name: 'Operations Research & Information Engineering (ORIE)', programs: [{ name: 'ORIE (BS)' }] },
        { name: 'Mechanical & Aerospace Engineering', programs: [{ name: 'Mechanical Engineering' }] },
      ],
    },
    {
      name: 'College of Arts & Sciences',
      departments: [{ name: 'Mathematics, Physics, Economics, …', programs: [] }],
    },
    { name: 'Other colleges', departments: [{ name: 'SC Johnson (Business/Dyson), CALS, Hotel Administration, Human Ecology', programs: [] }] },
  ],
  mit: [
    {
      name: 'School of Engineering',
      departments: [
        { name: 'Electrical Engineering & Computer Science (Course 6)', programs: [
          { name: '6-3 Computer Science & Engineering' },
          { name: '6-2 Electrical Engineering & Computer Science' },
          { name: '6-9 Computation & Cognition' },
          { name: 'Artificial Intelligence & Decision-Making', note: CONC },
        ] },
        { name: 'Mechanical Engineering (Course 2)', programs: [{ name: 'Mechanical Engineering' }] },
        { name: 'Aeronautics & Astronautics (Course 16)', programs: [{ name: 'Aerospace Engineering' }] },
      ],
    },
    { name: 'School of Science', departments: [{ name: 'Mathematics (18), Physics (8), Biology (7), …', programs: [] }] },
    { name: 'Other schools', departments: [{ name: 'Sloan (Management), Architecture & Planning, SHASS', programs: [] }] },
  ],
  uiuc: [
    {
      name: 'Grainger College of Engineering',
      departments: [
        { name: 'Computer Science', programs: [
          { name: 'Computer Science (BS)', note: 'direct-admit, single-digit rate' },
          { name: 'CS + X (e.g. CS+Astronomy, CS+Linguistics)', note: 'blended degrees spanning colleges — a materially less selective side door than straight CS' },
          { name: 'Artificial Intelligence', note: CONC },
        ] },
        { name: 'Electrical & Computer Engineering', programs: [{ name: 'Computer Engineering' }, { name: 'Electrical Engineering' }] },
      ],
    },
    { name: 'Other colleges', departments: [{ name: 'Gies (Business), Liberal Arts & Sciences, …', programs: [] }] },
  ],
  utaustin: [
    {
      name: 'College of Natural Sciences',
      departments: [
        { name: 'Computer Science', programs: [{ name: 'Computer Science (BS/BA)' }, { name: 'Turing Scholars', note: 'honors CS — far more selective than standard CS admission' }, { name: 'AI / Machine Learning', note: CONC }] },
        { name: 'Statistics & Data Sciences', programs: [{ name: 'Statistics & Data Science' }] },
        { name: 'Mathematics', programs: [{ name: 'Mathematics' }] },
      ],
    },
    {
      name: 'Cockrell School of Engineering',
      departments: [
        { name: 'Electrical & Computer Engineering', programs: [{ name: 'ECE (BS)' }] },
        { name: 'Aerospace / Biomedical / Chemical / Mechanical', programs: [] },
      ],
    },
    { name: 'Other colleges', departments: [{ name: 'McCombs (Business), Liberal Arts, School of Information', programs: [] }] },
  ],
  berkeley: [
    {
      name: 'College of Engineering',
      departments: [{ name: 'Electrical Engineering & Computer Sciences (EECS)', programs: [{ name: 'EECS (BS)', note: 'direct-admit, among the most selective majors nationally' }] }],
    },
    {
      name: 'College of Computing, Data Science & Society',
      departments: [
        { name: 'Computer Science (L&S)', programs: [{ name: 'L&S Computer Science', note: 'direct-admit since fall 2023' }] },
        { name: 'Data Science', programs: [{ name: 'Data Science (BA)' }] },
        { name: 'Statistics', programs: [{ name: 'Statistics' }] },
      ],
    },
    { name: 'Other colleges', departments: [{ name: 'Letters & Science, Haas (Business), Chemistry, Environmental Design', programs: [] }] },
  ],
  georgia_tech: [
    {
      name: 'College of Computing',
      departments: [{ name: 'Computer Science', programs: [{ name: 'Computer Science (BS)', note: 'threads model — pick two of Intelligence, Systems, Info Networks, etc.' }, { name: 'Computational Media' }] }],
    },
    {
      name: 'College of Engineering',
      departments: [{ name: 'Electrical & Computer Engineering', programs: [{ name: 'Computer Engineering' }, { name: 'Electrical Engineering' }] }],
    },
    { name: 'Other colleges', departments: [{ name: 'Scheller (Business), Sciences, Design, Liberal Arts', programs: [] }] },
  ],
  stanford: [
    {
      name: 'School of Engineering',
      departments: [
        { name: 'Computer Science', programs: [{ name: 'Computer Science (BS)', note: 'declared after enrollment — no admission by major' }, { name: 'AI track', note: CONC }, { name: 'Systems track', note: CONC }] },
        { name: 'Electrical Engineering', programs: [{ name: 'Electrical Engineering' }] },
      ],
    },
    { name: 'School of Humanities & Sciences', departments: [{ name: 'Mathematics, Symbolic Systems, Economics, …', programs: [] }] },
  ],
};

/**
 * Build the structure for a school. Verified schools return the real
 * hierarchy; everything else returns a single flattened "college" from the
 * major list, explicitly marked low-confidence.
 */
export function buildSchoolStructure(school: School): SchoolStructure {
  const verified = VERIFIED_STRUCTURE[school.id];
  if (verified) {
    return {
      schoolId: school.id,
      colleges: verified,
      confidence: 'high',
      note: 'Hand-verified college/department structure for the CS/engineering paths. Confirm exact program names and requirements on the official site.',
    };
  }
  return {
    schoolId: school.id,
    colleges: [{
      name: 'Programs (college/department structure not yet detailed)',
      departments: [{ name: 'Majors offered', programs: school.majors.map(m => ({ name: m })) }],
    }],
    confidence: 'low',
    note: 'We have not verified this school\'s college/department hierarchy — the list above is its majors, flattened. Check the official academic catalog for how they group into colleges and departments.',
  };
}

/* ── Program reputation (qualitative, sourced overall rank) ── */

export type ReputationTier = 'Nationally Recognized' | 'Strong' | 'Solid' | 'Emerging';

export interface ProgramReputation {
  field: string;
  /** The one real number: overall institution rank, with source. */
  overallRankingNote: string;
  fieldTier: ReputationTier;
  signals: string[];
  disclaimer: string;
}

const CS_RE = /comp(uter)?\s*sci|software|\bcs\b|\bece\b|electrical|artificial intelligence|\bai\b|machine learning|data science|robotics/i;

/**
 * Derive a qualitative reputation for a field at a school. NEVER emits a
 * program-rank number — only the sourced overall rank plus a tier word
 * justified by observable signals.
 */
export function deriveProgramReputation(school: School, field: string): ProgramReputation {
  const isCs = CS_RE.test(field);
  const facts = getSchoolFacts(school.id);
  const signals: string[] = [];

  // Signal 1: overall standing.
  if (school.topRanked) signals.push('Top-ranked institution overall (US News).');

  // Signal 2: field-specific published strengths.
  const fieldLower = field.toLowerCase().split('/')[0].trim();
  const relevantHighlights = (school.highlights ?? []).filter(h =>
    h.toLowerCase().includes(fieldLower) || (isCs && /\bcs\b|computer|comput|ai|machine learning|robot/i.test(h)),
  );
  for (const h of relevantHighlights.slice(0, 3)) signals.push(h);

  // Signal 3: CS gating as a proxy for demand/selectivity (not quality, labeled as such).
  if (isCs && facts?.csMajor) {
    const comp = facts.csMajor.value.competitiveness;
    if (comp === 'extreme') signals.push('CS admission is among the most competitive nationally — a demand signal, not a ranking.');
    else if (comp === 'high') signals.push('CS admission is notably more competitive than the campus rate.');
  }

  // Tier: conservative, evidence-gated.
  let fieldTier: ReputationTier;
  const offersField = school.majors.some(m => m.toLowerCase().includes(fieldLower) || fieldLower.includes(m.toLowerCase())) || (isCs && school.majors.some(m => CS_RE.test(m)));
  if (school.topRanked && relevantHighlights.length > 0) fieldTier = 'Nationally Recognized';
  else if (school.topRanked || relevantHighlights.length > 0) fieldTier = 'Strong';
  else if (offersField) fieldTier = 'Solid';
  else fieldTier = 'Emerging';

  if (signals.length === 0) {
    signals.push(offersField
      ? `${school.short} offers ${field}, but we have no published field-specific reputation signals on file.`
      : `No evidence on file that ${school.short} offers ${field} as a distinct program — verify before relying on this.`);
  }

  return {
    field,
    overallRankingNote: `US News national universities: #${school.ranking} overall (institution-wide; 2024-25 cycle).`,
    fieldTier,
    signals,
    disclaimer: 'Qualitative reputation from observable signals, NOT an official program ranking. For program-level standing, consult the current US News / QS subject rankings directly.',
  };
}
