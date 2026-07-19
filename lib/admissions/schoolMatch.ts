/**
 * Admission Intelligence — Match & Strategy layer.
 *
 * Answers "why does this school fit MY child, and how should we apply?" using
 * only what we already compute: the LLM profile assessment (10 dimensions +
 * verification), the school evidence layer, and the deterministic engine.
 * ZERO new data dependencies.
 *
 * Honesty rules carried over from the engine:
 *  - Fit axes are TIER WORDS with cited evidence, never bare 0-100 scores.
 *  - Major recommendations are ranked with reasons, not fabricated percentages.
 *  - Anything the LLM couldn't verify stays flagged, not smoothed over.
 */

import type { School, Student } from '@/types';
import { getSchoolFacts } from './schoolFacts';
import { evaluateSchool, extractStudentNumbers, isInternationalApplicant } from './engine';
import { TIER_META, tierIndex, type Tier } from './definitions';
import { DIMENSION_KEYS } from './assessment';
import type { DimensionAssessment, DimensionKey, ProfileAssessment } from './assessment';

/* ── Fit axes (qualitative — tier word + evidence) ─────────── */

export type FitLevel = 'Excellent' | 'Strong' | 'Moderate' | 'Limited' | 'Unknown';

/** Single source of truth for fit ordering (weakest → strongest). */
export const FIT_ORDER: FitLevel[] = ['Unknown', 'Limited', 'Moderate', 'Strong', 'Excellent'];
export function fitRank(level: FitLevel): number {
  return FIT_ORDER.indexOf(level);
}

export interface FitAxis {
  key: 'academic' | 'program' | 'research' | 'culture' | 'narrative' | 'admission_difficulty';
  label: string;
  level: FitLevel;
  /** One sentence, grounded in profile/school evidence. */
  rationale: string;
}

const DIM_TO_LEVEL: Record<string, FitLevel> = {
  exceptional: 'Excellent', strong: 'Strong', solid: 'Moderate', developing: 'Limited', concern: 'Limited',
};

function dimLevel(d: DimensionAssessment | undefined): FitLevel {
  return d ? DIM_TO_LEVEL[d.tier] ?? 'Moderate' : 'Unknown';
}

const NEUTRAL_DIM: DimensionAssessment = {
  tier: 'solid', evidence: [], missing: [], risks: [],
  verifiability: 'self_reported_only', confidence: 'low',
  reader_interpretation: '', overstatement_risk: 'low',
};

/**
 * Safe dimension accessor. A persisted/older assessment may be missing a key;
 * degrade to a neutral placeholder rather than crashing the whole match.
 */
function safeDim(dims: ProfileAssessment['dimensions'], key: DimensionKey): DimensionAssessment {
  return dims[key] ?? NEUTRAL_DIM;
}

/**
 * Fill any missing dimensions so downstream consumers (including the engine,
 * which reads dims directly) never hit an undefined key.
 */
function completeAssessment(assessment: ProfileAssessment): ProfileAssessment {
  const dims = { ...assessment.dimensions };
  for (const key of DIMENSION_KEYS) {
    if (!dims[key]) (dims as Record<string, DimensionAssessment>)[key] = NEUTRAL_DIM;
  }
  return { ...assessment, dimensions: dims };
}

/** Combine two dimension levels, taking the weaker as the honest floor. */
function weakerLevel(a: FitLevel, b: FitLevel): FitLevel {
  return fitRank(a) <= fitRank(b) ? a : b;
}

/* ── Strength alignment & gaps ─────────────────────────────── */

export interface AlignmentItem {
  label: string;
  level: FitLevel;
  detail: string;
}

/* ── Major recommendation ──────────────────────────────────── */

export interface MajorRecommendation {
  major: string;
  fit: FitLevel;
  reason: string;
  /** True when this is the student's own intended major. */
  isIntended: boolean;
  /** True when this major is gated (capped/direct-admit) at this school. */
  gated: boolean;
  caution?: string;
}

/* ── Full match result ─────────────────────────────────────── */

export interface SchoolMatch {
  schoolId: string;
  schoolShort: string;
  /** Overall fit as a tier word, derived from the axes (no numeric score). */
  overall: FitLevel;
  overallRationale: string;
  axes: FitAxis[];
  strengths: AlignmentItem[];
  weaknesses: AlignmentItem[];
  majorRecommendations: MajorRecommendation[];
  /** The engine's tier for context (admission difficulty ≠ fit). */
  admissionTier: Tier;
  admissionBand: { min: number; max: number };
}

const CS_RE = /comp(uter)?\s*sci|software|\bcs\b|\bece\b|electrical|artificial intelligence|\bai\b|machine learning|data science|robotics/i;

/** Rank a school's majors by fit for this student. Reasons are evidence-based. */
function recommendMajors(student: Student, school: School, dims: ProfileAssessment['dimensions']): MajorRecommendation[] {
  const nums = extractStudentNumbers(student);
  const csFacts = getSchoolFacts(school.id)?.csMajor;
  const majorPrep = safeDim(dims, 'major_preparation');
  // Intended major as a normalized token set, ignoring joiners.
  const intendedTokens = new Set(
    student.major.toLowerCase().split(/[/,&]|\band\b/).map(s => s.trim()).filter(Boolean),
  );
  // A school major is the "intended" one only when its full normalized name
  // matches one of the intended segments — not a loose substring (which made
  // "Engineering" match "Computer Science and Engineering").
  const isIntendedMajor = (ml: string) => intendedTokens.has(ml);

  return school.majors.slice(0, 6).map(major => {
    const ml = major.toLowerCase().trim();
    const isIntended = isIntendedMajor(ml);
    const isCsFamily = CS_RE.test(major);
    const csGated = isCsFamily && csFacts
      && (csFacts.value.competitiveness === 'extreme' || csFacts.value.competitiveness === 'high');

    let fit: FitLevel;
    let reason: string;
    if (isIntended || (isCsFamily && nums.csIntent)) {
      fit = dimLevel(majorPrep);
      reason = majorPrep.tier === 'exceptional' || majorPrep.tier === 'strong'
        ? `Direct match to the student's demonstrated preparation (${majorPrep.evidence[0] ?? 'strong major coursework'}).`
        : `Aligns with intended direction, though major preparation grades only ${majorPrep.tier}.`;
    } else if (isCsFamily) {
      fit = 'Moderate';
      reason = 'Adjacent to the student\'s CS/AI focus — a viable pivot, though preparation specific to this major is unverified.';
    } else {
      fit = 'Limited';
      reason = 'Outside the student\'s demonstrated academic focus; would need a distinct rationale.';
    }

    return {
      major,
      fit,
      reason,
      isIntended,
      gated: Boolean(csGated) || (csFacts?.value.directAdmit && isCsFamily) || false,
      caution: csGated
        ? `${major} is a gated/direct-admit program here — admission is materially harder than the campus rate.`
        : undefined,
    };
    // Sort by fit, then break ties toward the student's actual intended major.
  }).sort((a, b) => fitRank(b.fit) - fitRank(a.fit) || Number(b.isIntended) - Number(a.isIntended));
}

export function computeSchoolMatch(student: Student, school: School, rawAssessment: ProfileAssessment): SchoolMatch {
  const assessment = completeAssessment(rawAssessment);
  const dims = assessment.dimensions;
  const nums = extractStudentNumbers(student);
  const evaluation = evaluateSchool(student, nums, assessment, school);

  // Pull the dimensions we read directly, safely.
  const academic = safeDim(dims, 'academic_readiness');
  const narrative = safeDim(dims, 'narrative_coherence');
  const leadership = safeDim(dims, 'leadership_impact');
  const majorPrep = safeDim(dims, 'major_preparation');

  // Program fit: does the student's intent map to a real strength of this school?
  const majorLower = student.major.toLowerCase().split('/')[0].trim();
  const schoolOffersMajor = school.majors.some(m => m.toLowerCase().includes(majorLower) || majorLower.includes(m.toLowerCase()));
  const programLevel: FitLevel = schoolOffersMajor
    ? weakerLevel(dimLevel(majorPrep), 'Strong')
    : 'Limited';

  // Research fit: student's research/intellectual signal vs a research-heavy school.
  const researchHeavy = school.vibe.includes('Research') || school.topRanked;
  const researchLevel = weakerLevel(
    dimLevel(safeDim(dims, 'intellectual_vitality')),
    dimLevel(safeDim(dims, 'extracurricular_distinction')),
  );

  const axes: FitAxis[] = [
    {
      key: 'academic', label: 'Academic Fit', level: dimLevel(academic),
      rationale: academic.evidence[0] ?? `Academic readiness graded ${academic.tier}.`,
    },
    {
      key: 'program', label: 'Program Fit', level: programLevel,
      rationale: schoolOffersMajor
        ? `${school.short} offers the intended major; preparation graded ${majorPrep.tier}.`
        : `${school.short} is not a natural home for "${student.major}" — verify the program exists and fits.`,
    },
    {
      key: 'research', label: 'Research Fit', level: researchHeavy ? researchLevel : weakerLevel(researchLevel, 'Strong'),
      rationale: researchHeavy
        ? `Research-focused school; the student's intellectual/EC signal grades ${researchLevel.toLowerCase()}.`
        : 'This school is less research-intensive; strong research background is a nice-to-have, not a gate.',
    },
    {
      key: 'culture', label: 'Culture Fit', level: culturalFit(student, school),
      rationale: culturalRationale(student, school),
    },
    {
      key: 'narrative', label: 'Narrative Fit', level: dimLevel(narrative),
      rationale: narrative.evidence[0] ?? `Narrative coherence graded ${narrative.tier}; ${school.angle}`,
    },
    {
      key: 'admission_difficulty', label: 'Admission Difficulty', level: difficultyLevel(evaluation.tier),
      rationale: `Engine tier: ${evaluation.tierLabel} (${evaluation.band.min}–${evaluation.band.max}%). ${evaluation.ceilingReason}`,
    },
  ];

  // Overall = weakest KNOWN fit axis (excluding difficulty). "Unknown" means
  // missing input, not poor fit, so it never drags the overall down — but it
  // does cap confidence at "Strong" since we can't confirm Excellent blind.
  const fitAxes = axes.filter(a => a.key !== 'admission_difficulty');
  const knownAxes = fitAxes.filter(a => a.level !== 'Unknown');
  const unknownAxes = fitAxes.filter(a => a.level === 'Unknown');
  const rawOverall = knownAxes.length
    ? knownAxes.reduce<FitLevel>((acc, a) => weakerLevel(acc, a.level), 'Excellent')
    : 'Unknown';
  const overall: FitLevel = unknownAxes.length && rawOverall === 'Excellent' ? 'Strong' : rawOverall;

  // Strengths: verified exceptional/strong dimensions that this school rewards.
  const strengths: AlignmentItem[] = [];
  const addStrength = (key: DimensionKey, label: string) => {
    const d = dims[key];
    if (d && (d.tier === 'exceptional' || d.tier === 'strong')
      && (d.verifiability === 'externally_verified' || d.verifiability === 'institution_affiliated' || d.verifiability === 'link_verified')) {
      strengths.push({ label, level: dimLevel(d), detail: d.evidence[0] ?? `Graded ${d.tier}.` });
    }
  };
  addStrength('major_preparation', 'Major preparation');
  addStrength('intellectual_vitality', 'Intellectual vitality');
  addStrength('extracurricular_distinction', 'Distinction / spike');
  addStrength('academic_readiness', 'Academic readiness');
  addStrength('curriculum_rigor_in_context', 'Curriculum rigor');

  // Weaknesses: reuse the engine's flags + assessment gaps that matter here.
  const weaknesses: AlignmentItem[] = [];
  if (leadership.tier === 'developing' || leadership.tier === 'concern') {
    weaknesses.push({ label: 'Leadership footprint', level: 'Limited', detail: leadership.risks[0] ?? 'Little organization-building or team leadership evidence.' });
  }
  for (const [key, d] of Object.entries(dims)) {
    if ((d.tier === 'exceptional' || d.tier === 'strong') && d.verifiability === 'self_reported_only') {
      weaknesses.push({ label: `Unverified: ${key.replace(/_/g, ' ')}`, level: 'Moderate', detail: 'Strong on paper but no external anchor an AO can check — verify before relying on it.' });
    }
  }
  if (researchHeavy && !assessment.spike.has_spike) {
    weaknesses.push({ label: 'No clear spike', level: 'Moderate', detail: `${school.short} rewards a defined spike; the profile reads broad rather than pointed.` });
  }
  if (evaluation.flags.includes('major_locked')) {
    weaknesses.push({ label: 'Gated major', level: 'Limited', detail: `The intended major is direct-admit/capped here — internal transfer in is very hard.` });
  }

  // Honest overall rationale: never claim "every dimension is strong+" when
  // some axis was Unknown (un-judged, not confirmed).
  const overallRationale = (() => {
    const unknownLabels = unknownAxes.map(a => a.label).join(', ');
    if (overall === 'Excellent') {
      return 'Every measured fit dimension lands excellent — a genuinely aligned target.';
    }
    if (overall === 'Strong') {
      return unknownAxes.length
        ? `Strong across every measured dimension; ${unknownLabels} could not be judged (missing input), which caps confidence below Excellent.`
        : 'Every fit dimension lands strong or better — a genuinely aligned target.';
    }
    if (overall === 'Unknown') {
      return 'Not enough profile input to judge fit for this school yet.';
    }
    const weakest = knownAxes.find(a => a.level === overall)?.label ?? 'a fit axis';
    return `Overall fit is held to "${overall}" by the weakest measured dimension (${weakest})${unknownAxes.length ? `; ${unknownLabels} could not be judged` : ''}.`;
  })();

  return {
    schoolId: school.id,
    schoolShort: school.short,
    overall,
    overallRationale,
    axes,
    strengths: strengths.slice(0, 6),
    weaknesses: weaknesses.slice(0, 5),
    majorRecommendations: recommendMajors(student, school, dims),
    admissionTier: evaluation.tier,
    admissionBand: evaluation.band,
  };
}

/* ── Small helpers ─────────────────────────────────────────── */

function difficultyLevel(tier: Tier): FitLevel {
  // Higher tier = easier admit = "better" difficulty fit.
  const idx = tierIndex(tier);
  if (idx >= tierIndex('likely')) return 'Excellent';
  if (idx >= tierIndex('possible')) return 'Strong';
  if (idx >= tierIndex('reach')) return 'Moderate';
  return 'Limited';
}

function culturalFit(student: Student, school: School): FitLevel {
  const prefsSettings = student.preferredSettings ?? [];
  const prefsSizes = student.preferredSchoolSizes ?? [];
  let hits = 0, checks = 0;
  if (prefsSettings.length) { checks++; if (prefsSettings.includes(school.setting)) hits++; }
  if (prefsSizes.length) { checks++; if (prefsSizes.includes(school.size)) hits++; }
  if (!checks) return 'Unknown';
  return hits === checks ? 'Strong' : hits > 0 ? 'Moderate' : 'Limited';
}

function culturalRationale(student: Student, school: School): string {
  const bits: string[] = [`${school.setting} · ${school.size}`];
  if (student.preferredSettings?.length) bits.push(`prefers ${student.preferredSettings.join('/')}`);
  if (student.preferredSchoolSizes?.length) bits.push(`prefers ${student.preferredSchoolSizes.join('/')} size`);
  if (bits.length === 1) bits.push('no stated setting/size preference — cannot judge culturally');
  return bits.join('; ');
}

/* ── Application strategy (round + essay + material gaps) ───── */

export interface ApplicationStrategy {
  schoolId: string;
  recommendedRound: 'ED' | 'EA' | 'REA' | 'RD';
  roundRationale: string;
  roundStrength: FitLevel;
  suggestedMajor: string;
  alternativeMajor?: string;
  avoid?: string;
  essayAngles: string[];
  materialGaps: string[];
}

export function computeApplicationStrategy(
  student: Student, school: School, assessment: ProfileAssessment, match: SchoolMatch,
): ApplicationStrategy {
  const facts = getSchoolFacts(school.id);
  const early = facts?.earlyRounds?.value;
  const edGrade = facts?.edStrategicValue?.value;
  const isIntlAidNeeded = isInternationalApplicant(student) && student.needBasedAid === 'Yes';

  let recommendedRound: ApplicationStrategy['recommendedRound'] = 'RD';
  let roundRationale: string;
  let roundStrength: FitLevel = 'Moderate';

  const offersEA = early === 'EA_ED'; // has a non-binding EA alongside ED
  if (early && ['ED', 'ED1_ED2', 'EA_ED'].includes(early)) {
    if (edGrade === 'high_leverage' && !isIntlAidNeeded) {
      recommendedRound = 'ED'; roundStrength = 'Excellent';
      roundRationale = `Binding ED is the strongest lever here (${facts?.edStrategicValue?.meta.note ?? 'high-leverage round'}).`;
    } else if (edGrade === 'high_leverage' && isIntlAidNeeded) {
      recommendedRound = 'RD'; roundStrength = 'Limited';
      roundRationale = 'ED would help, but binding before comparing aid offers is risky for an aid-dependent applicant — lean RD unless the family can commit financially.';
    } else if (edGrade === 'not_recommended' || edGrade === 'limited') {
      // Don't steer into binding ED where it carries no real edge.
      recommendedRound = offersEA ? 'EA' : 'RD';
      roundStrength = offersEA ? 'Strong' : 'Moderate';
      roundRationale = offersEA
        ? `ED here is ${(edGrade).replace(/_/g, ' ')} leverage — take the non-binding EA instead and keep aid/options open.`
        : `ED here is ${(edGrade).replace(/_/g, ' ')} leverage — binding commitment isn't worth it; apply RD.`;
    } else if (isIntlAidNeeded) {
      recommendedRound = offersEA ? 'EA' : 'RD'; roundStrength = 'Moderate';
      roundRationale = 'Aid-dependent applicant: avoid binding before comparing offers — use the non-binding round if available, else RD.';
    } else {
      recommendedRound = 'ED'; roundStrength = 'Moderate';
      roundRationale = `ED available with ${(edGrade ?? 'moderate').replace(/_/g, ' ')} leverage — worth it only if this is a clear first choice.`;
    }
  } else if (early === 'REA') {
    recommendedRound = 'REA'; roundStrength = 'Moderate';
    roundRationale = 'Restrictive early action signals interest without binding; blocks other early apps.';
  } else if (early === 'EA') {
    recommendedRound = 'EA'; roundStrength = 'Strong';
    roundRationale = 'Non-binding EA — apply early for the deadline advantage with no downside.';
  } else {
    roundRationale = 'No binding early round that helps here — apply RD and focus on differentiation.';
  }

  const topMajor = match.majorRecommendations[0];
  const altMajor = match.majorRecommendations.find(m => m.major !== topMajor?.major);
  // Only warn away from a poor-fit gated major that ISN'T the student's own
  // intent (never tell them to avoid the thing they came to study — that's a
  // "strengthen prep" note handled elsewhere, not an avoid).
  const avoid = match.majorRecommendations.find(m => m.fit === 'Limited' && m.gated && !m.isIntended);

  // Essay angles from the verified spike + school's stated angle.
  const essayAngles: string[] = [];
  if (assessment.spike.has_spike) essayAngles.push(`Center the ${assessment.spike.domain} spike — it's the differentiator.`);
  if (school.angle) essayAngles.push(`Address ${school.short}'s emphasis: ${school.angle}`);
  const topStrength = match.strengths[0];
  if (topStrength) essayAngles.push(`Lead with verified strength: ${topStrength.detail}`);

  // Material gaps = the assessment's own gaps + unverified strengths.
  const materialGaps = [
    ...assessment.assessment_gaps.slice(0, 2),
    ...match.weaknesses.filter(w => w.label.startsWith('Unverified')).map(w => w.detail),
  ].slice(0, 4);

  return {
    schoolId: school.id,
    recommendedRound,
    roundRationale,
    roundStrength,
    suggestedMajor: topMajor?.major ?? student.major,
    alternativeMajor: altMajor?.major,
    avoid: avoid ? `${avoid.major} — ${avoid.reason}` : undefined,
    essayAngles: essayAngles.slice(0, 3),
    materialGaps,
  };
}

export { TIER_META };
