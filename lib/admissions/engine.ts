/**
 * Phase 1 — deterministic rules & calibration layer.
 *
 * Takes the LLM's qualitative profile assessment + the evidence data layer
 * and produces, per school: a tier, a wide probability band, and a complete
 * adjustment trace (why it moved up or down). Same inputs → same outputs,
 * every step auditable.
 *
 * "Low chance" and "cannot reliably judge" are kept strictly apart via the
 * dataConfidence / assessmentConfidence labels.
 */

import type { School, Student } from '@/types';
import {
  type AdjustmentRecord,
  type ConfidenceLevel,
  type Tier,
  type TierBand,
  TIER_META,
  baseTierFromAdmitRate,
  minConfidence,
  selectivityCeiling,
  shiftTier,
  tierIndex,
} from './definitions';
import { LEGACY_STATS_PROVENANCE, getSchoolFacts, type SchoolAdmissionFacts } from './schoolFacts';
import type { DimensionAssessment, ProfileAssessment } from './assessment';

/**
 * Stamped on every result. Bump ENGINE_VERSION whenever a rule changes —
 * identical inputs must be explainable across policy/data updates.
 */
export const ENGINE_VERSION = '2.1.0';
export const DATA_CYCLE = '2025-26';

/*
 * SINGLE-COUNT PRINCIPLE: one piece of evidence may produce a numeric step
 * in at most ONE rule. Current numeric factors and their evidence sources:
 *   base_rate            ← school/program admit rate
 *   sat_* / gpa_*        ← raw test/GPA numbers (NOT the academic_readiness grade)
 *   major_gated          ← program competitiveness fact
 *   in_state/out_of_state/residency_unknown ← residency fact
 *   intl_need_aware      ← aid policy fact
 *   rigor_context        ← curriculum_rigor_in_context grade
 *   distinction*         ← max(extracurricular_distinction, major_preparation) — one credit
 *   very_likely_gate     ← major-access + affordability constraints
 * All other dimensions are explanatory only. Enforced by engine.test.ts.
 */

/* ── Output types ──────────────────────────────────────────── */

export interface SchoolEvaluation {
  schoolId: string;
  schoolName: string;
  short: string;
  ranking: number;
  tier: Tier;
  tierLabel: string;
  band: TierBand;
  uiBucket: 'reach' | 'match' | 'safety';
  baseTier: Tier;
  /** Which admit rate seeded the base tier, and why. */
  baseRateUsed: { pct: number; scope: 'institution' | 'major' };
  ceiling: Tier;
  ceilingReason: string;
  trace: AdjustmentRecord[];
  dataConfidence: ConfidenceLevel;
  assessmentConfidence: ConfidenceLevel;
  flags: string[];
  /** Unobservable/missing factors declared explicitly (hooks, missing program rates, unstated need). */
  unknowns: string[];
}

export interface PortfolioSummary {
  /**
   * Honest bounds on P(at least one admit), no correlation assumption:
   * lower = perfectly correlated outcomes (max pᵢ), upper = independent.
   * The truth lies in between; we refuse to pick a point in Phase 1.
   */
  pAtLeastOne: { lowerPct: number; upperPct: number; note: string };
  coverage: { reach: number; match: number; safety: number };
  shutoutRisk: 'low' | 'moderate' | 'high' | 'critical';
  warnings: string[];
  competitivenessLevels: { top10: string; top20: string; top50: string };
  /** Preferred-list entries that could not be matched to the school database. */
  unmatchedPreferred: string[];
}

/* ── Student numeric extraction ────────────────────────────── */

interface StudentNumbers {
  sat: number | null;
  gpa: number | null;
  isInternational: boolean;
  needsAid: boolean;
  stateResidency: string | null;
  csIntent: boolean;
}

const CS_MAJOR_RE = /comp(uter)?\s*sci|software|\bcs\b|\bcse\b|\bece\b|electrical|computer eng|artificial intelligence|\bai\b|machine learning|data science|robotics/i;

/**
 * Single source of truth for "is this applicant international" — UI panels
 * must use this too, or their aid signals will contradict the engine's.
 */
export function isInternationalApplicant(student: Student): boolean {
  const s = `${student.citizenship || ''} ${student.residencyStatus || ''}`.toLowerCase();
  return /international|visa|f-?1|non-?us|china|india|korea|foreign/.test(s) &&
    !/us citizen|u\.s\. citizen|permanent resident|green ?card/.test(s);
}

export function extractStudentNumbers(student: Student): StudentNumbers {
  // Tolerate formatted input ("1,540") — parseInt would truncate it to 1.
  const sat = parseInt((student.sat || '').replace(/[^\d]/g, ''), 10);
  const gpa = parseFloat(student.gpa);
  return {
    sat: Number.isFinite(sat) && sat >= 400 && sat <= 1600 ? sat : null,
    gpa: Number.isFinite(gpa) && gpa > 0 ? gpa : null,
    isInternational: isInternationalApplicant(student),
    needsAid: student.needBasedAid === 'Yes',
    stateResidency: student.stateResidency?.trim() || null,
    csIntent: CS_MAJOR_RE.test(`${student.major} ${student.secondary}`),
  };
}

/* ── Per-school evaluation ─────────────────────────────────── */

const US_STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

function isResidentOf(stateResidency: string | null, schoolState: string): boolean | null {
  if (!stateResidency) return null;
  const raw = stateResidency.trim().toLowerCase();
  const abbr = US_STATE_ABBR[raw] ?? (raw.length === 2 ? raw.toUpperCase() : null);
  if (!abbr) return null;
  return abbr === schoolState;
}

function dimTierScore(d: DimensionAssessment): number {
  return { exceptional: 2, strong: 1, solid: 0, developing: -1, concern: -2 }[d.tier];
}

export function evaluateSchool(
  student: Student,
  nums: StudentNumbers,
  assessment: ProfileAssessment,
  school: School,
): SchoolEvaluation {
  const facts: SchoolAdmissionFacts | undefined = getSchoolFacts(school.id);
  const trace: AdjustmentRecord[] = [];
  const flags: string[] = [];
  const dataConfParts: ConfidenceLevel[] = [LEGACY_STATS_PROVENANCE.confidence];
  const assessConfParts: ConfidenceLevel[] = [assessment.assessment_confidence];
  const dims = assessment.dimensions;

  /* 1. Base rate: use the major-specific rate when the student's intent hits a gated major. */
  const csFact = nums.csIntent ? facts?.csMajor : undefined;
  const majorRate = csFact?.value.admitRatePct;
  const useMajorRate = majorRate !== undefined && majorRate < school.accept;
  const baseRatePct = useMajorRate ? majorRate : school.accept;
  const baseTier = baseTierFromAdmitRate(baseRatePct);
  const { ceiling, reason: ceilingReason } = selectivityCeiling(baseRatePct);
  if (useMajorRate && csFact) dataConfParts.push(csFact.meta.confidence);
  trace.push({
    ruleId: 'base_rate',
    label: useMajorRate ? `Base: ${school.short} CS-specific admit rate ${baseRatePct}%` : `Base: overall admit rate ${baseRatePct}%`,
    stepDelta: 0,
    rationale: useMajorRate
      ? `Applying to a gated major: the ${baseRatePct}% program rate replaces the ${school.accept}% campus rate as the starting point. ${csFact?.meta.isEstimated ? '(Program rate is an estimate.)' : ''}`
      : `Starting tier "${TIER_META[baseTier].label}" is seeded from the published admit rate.`,
    basis: 'official_fact',
    confidence: useMajorRate && csFact ? csFact.meta.confidence : LEGACY_STATS_PROVENANCE.confidence,
  });

  let steps = 0;

  /* 2. Test scores vs school, respecting per-school test policy. */
  const policy = facts?.testPolicy;
  if (policy) dataConfParts.push(policy.meta.confidence);
  const policyValue = policy?.value ?? 'optional';
  if (policyValue === 'blind') {
    trace.push({
      ruleId: 'test_blind',
      label: 'Test-blind school — SAT not considered',
      stepDelta: 0,
      rationale: 'This school does not look at SAT/ACT at all; GPA, rigor and essays carry the full weight.',
      basis: 'official_fact',
      confidence: policy?.meta.confidence ?? 'medium',
    });
  } else if (nums.sat === null) {
    if (policyValue === 'required' || policyValue === 'flexible') {
      steps -= 1;
      flags.push('test_required_no_score');
      trace.push({
        ruleId: 'test_missing_required',
        label: 'No test score at a test-required school',
        stepDelta: -1,
        rationale: 'This school requires standardized testing. Without a score the application is incomplete — sitting the SAT/ACT is a prerequisite, not an option.',
        basis: 'official_fact',
        confidence: policy?.meta.confidence ?? 'medium',
      });
    } else {
      trace.push({
        ruleId: 'test_missing_optional',
        label: 'Applying test-optional (no score on file)',
        stepDelta: 0,
        rationale: 'Legitimate here, but the rest of the file must carry the academic signal alone.',
        basis: 'policy_rule',
        confidence: 'medium',
      });
    }
  } else {
    const delta = nums.sat - school.sat;
    if (delta >= 20) {
      steps += 1;
      trace.push({
        ruleId: 'sat_above',
        label: `SAT ${nums.sat} is ${delta >= 0 ? '+' : ''}${delta} vs median`,
        stepDelta: 1,
        rationale: 'At or above the enrolled-student median — testing is a positive signal here.',
        basis: 'derived_stat',
        confidence: 'medium',
      });
    } else if (delta <= -60) {
      if (policyValue === 'optional') {
        flags.push('withhold_score_recommended');
        trace.push({
          ruleId: 'sat_withhold',
          label: `SAT ${nums.sat} (${delta} vs median) — withhold recommended`,
          stepDelta: 0,
          rationale: 'Well below median at a test-optional school: applying without the score avoids the penalty, at the cost of losing the testing signal.',
          basis: 'policy_rule',
          confidence: 'medium',
        });
      } else {
        steps -= 1;
        trace.push({
          ruleId: 'sat_below',
          label: `SAT ${nums.sat} is ${delta} vs median`,
          stepDelta: -1,
          rationale: 'Meaningfully below the enrolled median at a school where scores must be submitted.',
          basis: 'derived_stat',
          confidence: 'medium',
        });
      }
    } else if (delta < 0) {
      trace.push({
        ruleId: 'sat_near_median',
        label: `SAT ${nums.sat} is ${delta} vs median`,
        stepDelta: 0,
        rationale: 'Slightly below median — inside the normal enrolled range, neither a boost nor a penalty.',
        basis: 'derived_stat',
        confidence: 'medium',
      });
    }
  }

  /* 3. GPA position (conservative: only penalize clear gaps — scales vary too much to reward). */
  if (nums.gpa !== null && nums.gpa - school.gpa <= -0.25) {
    steps -= 1;
    trace.push({
      ruleId: 'gpa_below',
      label: `GPA ${nums.gpa.toFixed(2)} vs median ${school.gpa.toFixed(2)}`,
      stepDelta: -1,
      rationale: 'Clearly below the enrolled median even allowing for weighting differences.',
      basis: 'derived_stat',
      confidence: 'low',
    });
  }

  /* 4. Gated-major penalty when no program rate was available to bake into the base. */
  if (nums.csIntent && csFact && !useMajorRate) {
    const comp = csFact.value.competitiveness;
    if (comp === 'extreme' || comp === 'high') {
      steps -= 1;
      dataConfParts.push(csFact.meta.confidence);
      trace.push({
        ruleId: 'major_gated',
        label: `CS admission is ${comp === 'extreme' ? 'far' : 'notably'} more competitive than the campus rate`,
        stepDelta: -1,
        rationale: csFact.meta.note ?? 'Direct-admit/capped CS pool is materially harder than the school-wide number suggests.',
        basis: 'official_fact',
        confidence: csFact.meta.confidence,
      });
    }
  }
  if (nums.csIntent && csFact?.value.directAdmit && csFact.value.internalTransfer === 'very_hard') {
    flags.push('major_locked');
  }

  /* 5. Residency (publics). */
  if (school.type === 'Public' && facts?.inStateAdvantage) {
    const adv = facts.inStateAdvantage;
    const resident = nums.isInternational ? false : isResidentOf(nums.stateResidency, school.state);
    dataConfParts.push(adv.meta.confidence);
    if (resident === true && adv.value !== 'none') {
      steps += 1;
      trace.push({
        ruleId: 'in_state',
        label: `In-state applicant (${school.state})`,
        stepDelta: 1,
        rationale: adv.meta.note ?? 'Residents face a materially friendlier admit rate here.',
        basis: 'official_fact',
        confidence: adv.meta.confidence,
      });
    } else if (resident === false && adv.value === 'strong') {
      steps -= 1;
      trace.push({
        ruleId: 'out_of_state',
        label: nums.isInternational ? 'International applicant at a resident-favoring public' : 'Out-of-state at a resident-favoring public',
        stepDelta: -1,
        rationale: adv.meta.note ?? 'Non-resident pool is substantially more selective than the headline rate.',
        basis: 'official_fact',
        confidence: adv.meta.confidence,
      });
    } else if (resident === null && adv.value === 'strong') {
      // Unknown residency at a strongly resident-favoring public: assume the
      // conservative case rather than silently skipping the rule.
      steps -= 1;
      assessConfParts.push('low');
      trace.push({
        ruleId: 'residency_unknown',
        label: 'Residency not provided — assumed non-resident',
        stepDelta: -1,
        rationale: 'This public strongly favors residents and no state residency is on file; assuming the harder non-resident pool. Add state residency to the profile to correct this.',
        basis: 'policy_rule',
        confidence: 'low',
      });
    }
  }

  /* 6. International + need-based aid. */
  if (nums.isInternational) {
    const needBlind = facts?.intlNeedBlind;
    const aidAvailable = facts?.intlAidAvailable;
    if (nums.needsAid && needBlind && !needBlind.value) {
      steps -= 1;
      dataConfParts.push(needBlind.meta.confidence);
      trace.push({
        ruleId: 'intl_need_aware',
        label: 'International + requesting aid at a need-aware school',
        stepDelta: -1,
        rationale: 'Aid requests are weighed in the admission decision for internationals here.',
        basis: 'official_fact',
        confidence: needBlind.meta.confidence,
      });
    } else if (nums.needsAid && needBlind?.value) {
      trace.push({
        ruleId: 'intl_need_blind',
        label: 'Need-blind for internationals',
        stepDelta: 0,
        rationale: 'Aid request does not affect the admission decision at this school.',
        basis: 'official_fact',
        confidence: needBlind.meta.confidence,
      });
    }
    if (nums.needsAid && aidAvailable && !aidAvailable.value) {
      flags.push('no_intl_need_aid');
    }
  }

  /* 7-8. Holistic signals from the LLM assessment — bounded to ±1 step each. */
  const rigor = dims.curriculum_rigor_in_context;
  if (rigor.tier === 'exceptional' || rigor.tier === 'concern') {
    const d = rigor.tier === 'exceptional' ? 1 : -1;
    steps += d;
    assessConfParts.push(rigor.confidence);
    trace.push({
      ruleId: 'rigor_context',
      label: `Curriculum rigor graded "${rigor.tier}" in school context`,
      stepDelta: d,
      rationale: rigor.evidence[0] ?? 'Rigor relative to what the high school offers.',
      basis: 'llm_assessment',
      confidence: rigor.confidence,
    });
  }

  const distinction = [dims.extracurricular_distinction, dims.major_preparation]
    .sort((a, b) => dimTierScore(b) - dimTierScore(a))[0];
  if (distinction.tier === 'exceptional') {
    if (distinction.verifiability === 'conflicting_or_incomplete') {
      // Conflicting materials are a positive reason to withhold credit.
      assessConfParts.push('low');
      flags.push('conflicting_evidence');
      trace.push({
        ruleId: 'distinction_conflicting',
        label: 'Exceptional distinction claimed but evidence conflicts or is incomplete',
        stepDelta: 0,
        rationale: 'Materials disagree or key facts are missing — resolve the conflict before this can count.',
        basis: 'llm_assessment',
        confidence: 'low',
      });
    } else {
      // "Not yet verified" ≠ "lower quality": credit is applied at every
      // verification state, but confidence drops and the band widens as
      // the anchor weakens. (externally_verified/institution_affiliated →
      // full confidence; link_verified → capped at medium; self_reported →
      // low + overstatement flag.)
      const creditConfidence: ConfidenceLevel =
        distinction.verifiability === 'externally_verified' || distinction.verifiability === 'institution_affiliated'
          ? distinction.confidence
          : distinction.verifiability === 'link_verified'
          ? minConfidence(distinction.confidence, 'medium')
          : 'low';
      if (distinction.verifiability === 'self_reported_only') flags.push('overstatement_risk');
      steps += 1;
      assessConfParts.push(creditConfidence);
      trace.push({
        ruleId: 'distinction',
        label: `Exceptional distinction (spike) — ${distinction.verifiability.replace(/_/g, ' ')}`,
        stepDelta: 1,
        rationale: distinction.evidence[0] ?? assessment.spike.summary,
        basis: 'llm_assessment',
        confidence: creditConfidence,
      });
    }
  } else if (dimTierScore(dims.extracurricular_distinction) <= -1 && dimTierScore(dims.leadership_impact) <= -1) {
    steps -= 1;
    trace.push({
      ruleId: 'distinction_weak',
      label: 'Extracurricular profile below the competitive pool',
      stepDelta: -1,
      rationale: 'Both distinction and leadership graded developing/concern — at selective schools the activity file is a real differentiator.',
      basis: 'llm_assessment',
      confidence: dims.extracurricular_distinction.confidence,
    });
  }

  /* 9. Early-round leverage. A COMMITTED ED choice at a high-leverage school
   * earns one bounded tier step (still under all ceilings); an uncommitted
   * opportunity stays informational. Published ED-pool rates are quoted as
   * context, never used as the applicant's probability — the pool is
   * hook-biased. */
  const plansEdHere = student.edChoiceId === school.id;
  const edGrade = facts?.edStrategicValue?.value;
  const edRateNote = facts?.edAdmitRatePct
    ? ` Reported ED-pool rate ~${facts.edAdmitRatePct.value}% (hook-biased, estimated).`
    : '';
  if (plansEdHere && facts?.edStrategicValue) {
    if (edGrade === 'high_leverage') {
      steps += 1;
      flags.push('ed_committed');
      dataConfParts.push(facts.edStrategicValue.meta.confidence);
      trace.push({
        ruleId: 'ed_commitment',
        label: 'Committed ED at a high-leverage binding round',
        stepDelta: 1,
        rationale: `Binding commitment is the strongest controllable lever at this school.${edRateNote} Bounded to one tier step; selectivity ceilings still apply.`,
        basis: 'expert_estimate',
        confidence: facts.edStrategicValue.meta.confidence,
      });
    } else {
      flags.push('ed_committed');
      trace.push({
        ruleId: 'ed_commitment_limited',
        label: `Committed early round graded "${(edGrade ?? 'unknown').replace(/_/g, ' ')}"`,
        stepDelta: 0,
        rationale: `${facts.edStrategicValue.meta.note ?? 'This early round carries little statistical leverage.'}${edRateNote}`,
        basis: 'expert_estimate',
        confidence: facts.edStrategicValue.meta.confidence,
      });
    }
  } else if (edGrade === 'high_leverage') {
    flags.push('ed_leverage');
    trace.push({
      ruleId: 'ed_opportunity',
      label: 'High-leverage binding early round available',
      stepDelta: 0,
      rationale: `${facts?.edStrategicValue?.meta.note ?? ''}${edRateNote} Committing ED here could improve the effective tier — see the round strategy section.`,
      basis: 'expert_estimate',
      confidence: facts?.edStrategicValue?.meta.confidence ?? 'low',
    });
  }

  /* Final tier: apply steps, clamp to the binding ceiling. Non-residents
   * (known or assumed) at strongly resident-favoring publics can never
   * treat the school as Likely+ — the seats simply aren't in their pool. */
  const nonResidentCapApplies =
    trace.some(t => t.ruleId === 'out_of_state' || t.ruleId === 'residency_unknown');
  let effectiveCeiling = ceiling;
  let effectiveCeilingReason = ceilingReason;
  if (nonResidentCapApplies && tierIndex('possible') < tierIndex(ceiling)) {
    effectiveCeiling = 'possible';
    effectiveCeilingReason = 'Non-resident pool at a strongly resident-favoring public — capped at Possible regardless of stats.';
  }
  const rawTier = shiftTier(baseTier, steps);
  let tier = rawTier;
  if (tierIndex(rawTier) > tierIndex(effectiveCeiling)) {
    tier = effectiveCeiling;
    trace.push({
      ruleId: 'selectivity_ceiling',
      label: `Capped at "${TIER_META[effectiveCeiling].label}"`,
      stepDelta: tierIndex(effectiveCeiling) - tierIndex(rawTier),
      rationale: effectiveCeilingReason,
      basis: 'policy_rule',
      confidence: 'high',
    });
  }

  /* "Very Likely" is a triple claim: admission + major access + affordability.
   * Unless all three hold, the label stops at Likely — a school you can't
   * afford or whose major you can't enter is not a true safety. */
  if (tier === 'very_likely') {
    const majorUnconfirmed = nums.csIntent && !!csFact &&
      (csFact.value.competitiveness === 'extreme' || csFact.value.competitiveness === 'high');
    const affordabilityUnconfirmed = student.needBasedAid !== 'No' || flags.includes('no_intl_need_aid');
    if (majorUnconfirmed || affordabilityUnconfirmed) {
      tier = 'likely';
      flags.push('very_likely_gated');
      trace.push({
        ruleId: 'very_likely_gate',
        label: 'Held at "Likely" — Very Likely requires admission + major access + affordability',
        stepDelta: -1,
        rationale: [
          majorUnconfirmed ? 'direct entry to the intended major is not assured at this school' : '',
          affordabilityUnconfirmed ? 'affordability is not confirmed (set need-based aid status / budget in the profile, or verify a scholarship path)' : '',
        ].filter(Boolean).join('; '),
        basis: 'policy_rule',
        confidence: 'high',
      });
    }
  }

  /* Unobservables — declared, never silently assumed. */
  const unknowns: string[] = ['hooks_not_modeled'];
  if (nums.csIntent && !csFact) unknowns.push('major_specific_data_unavailable');
  if (nums.csIntent && csFact && csFact.value.admitRatePct === undefined) unknowns.push('major_specific_rate_unavailable');
  if (student.needBasedAid === undefined || student.needBasedAid === 'Unsure') unknowns.push('financial_need_unstated');

  /* Confidence + band (widen when confidence is low — uncertainty must be visible). */
  const dataConfidence = minConfidence(...dataConfParts);
  const usedDims = [rigor, distinction, dims.academic_readiness];
  const assessmentConfidence = minConfidence(...assessConfParts, ...usedDims.map(d => d.confidence));
  const base = TIER_META[tier].band;
  const widen = (dataConfidence === 'low' ? 5 : 0) + (assessmentConfidence === 'low' ? 5 : 0);
  const band: TierBand = {
    min: Math.max(1, base.min - Math.ceil(widen / 2)),
    max: Math.min(95, base.max + widen),
  };

  return {
    schoolId: school.id,
    schoolName: school.name,
    short: school.short,
    ranking: school.ranking,
    tier,
    tierLabel: TIER_META[tier].label,
    band,
    uiBucket: TIER_META[tier].uiBucket,
    baseTier,
    baseRateUsed: { pct: baseRatePct, scope: useMajorRate ? 'major' : 'institution' },
    ceiling: effectiveCeiling,
    ceilingReason: effectiveCeilingReason,
    trace,
    dataConfidence,
    assessmentConfidence,
    flags,
    unknowns,
  };
}

/* ── Portfolio selection (deterministic, preference-aware) ── */

export interface PortfolioTargets { reach: number; match: number; safety: number }

/** Hard cap on the student's own list. */
export const MAX_PREFERRED_SCHOOLS = 20;

export function targetsForRisk(risk: Student['risk']): PortfolioTargets {
  if (risk === 'Aggressive') return { reach: 4, match: 4, safety: 2 };
  if (risk === 'Conservative') return { reach: 2, match: 4, safety: 3 };
  return { reach: 3, match: 4, safety: 3 };
}

/**
 * Resolve the student's own school list: structured ids first, else
 * name-matching the legacy free-text field. Unresolvable names are
 * reported, never silently dropped.
 */
export function resolvePreferredPool(
  student: Student,
  schools: School[],
): { ids: string[]; unmatched: string[] } {
  const byId = new Set(schools.map(s => s.id));
  if (student.preferredSchoolIds?.length) {
    return {
      ids: student.preferredSchoolIds.filter(id => byId.has(id)).slice(0, MAX_PREFERRED_SCHOOLS),
      unmatched: student.preferredSchoolIds.filter(id => !byId.has(id)),
    };
  }
  const names = (student.preferred || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).slice(0, MAX_PREFERRED_SCHOOLS);
  const ids: string[] = [];
  const unmatched: string[] = [];
  for (const n of names) {
    const ln = n.toLowerCase();
    const hit = schools.find(s =>
      s.name.toLowerCase().includes(ln) || s.short.toLowerCase().includes(ln) || ln.includes(s.short.toLowerCase()));
    if (hit) {
      if (!ids.includes(hit.id)) ids.push(hit.id);
    } else {
      unmatched.push(n);
    }
  }
  return { ids, unmatched };
}

/** Match a user-entered geography preference ("Texas", "TX", "West") against a school. */
export function matchesRegionOrState(entry: string, school: School): boolean {
  const e = entry.trim().toLowerCase();
  if (!e) return false;
  if (e === school.region.toLowerCase()) return true;
  const abbr = US_STATE_ABBR[e] ?? (e.length === 2 ? e.toUpperCase() : null);
  return abbr === school.state;
}

function preferenceScore(student: Student, school: School): number {
  let score = 0;
  if (student.excludedRegions?.some(r => matchesRegionOrState(r, school))) score -= 1000;
  if (student.preferredRegions?.some(r => matchesRegionOrState(r, school))) score += 8;
  if (student.preferredSettings?.length && student.preferredSettings.includes(school.setting)) score += 3;
  if (student.preferredSchoolSizes?.length && student.preferredSchoolSizes.includes(school.size)) score += 3;
  const majorLower = student.major.toLowerCase();
  if (school.majors.some(m => m.toLowerCase().includes(majorLower) || majorLower.includes(m.toLowerCase()))) score += 6;
  // Target range: prefer schools inside the stated ambition window
  const cap = student.targetRange === 'Top 10' ? 15 : student.targetRange === 'Top 20' ? 30 : 60;
  if (school.ranking <= cap) score += 4;
  score -= school.ranking * 0.05; // gentle rank tiebreaker
  return score;
}

const BUCKET_ORDER: Record<'reach' | 'match' | 'safety', number> = { reach: 0, match: 1, safety: 2 };

export interface PortfolioSelection {
  /** The list under analysis — the student's own picks when they gave any. */
  selected: SchoolEvaluation[];
  /** Engine-proposed additions that patch coverage gaps; never mixed into `selected`. */
  suggestions: SchoolEvaluation[];
  targets: PortfolioTargets;
  unmatchedPreferred: string[];
}

export function selectPortfolio(
  student: Student,
  evaluations: SchoolEvaluation[],
  schoolsById: Map<string, School>,
): PortfolioSelection {
  const targets = targetsForRisk(student.risk);
  const { ids: poolIds, unmatched } = resolvePreferredPool(student, [...schoolsById.values()]);
  const evalById = new Map(evaluations.map(e => [e.schoolId, e]));

  const sortEvals = (list: SchoolEvaluation[]) =>
    [...list].sort((a, b) => BUCKET_ORDER[a.uiBucket] - BUCKET_ORDER[b.uiBucket] || a.ranking - b.ranking);

  const pickOutside = (pool: Set<string>, bucket: 'reach' | 'match' | 'safety', n: number): SchoolEvaluation[] => {
    if (n <= 0) return [];
    return evaluations
      .filter(ev => ev.uiBucket === bucket && !pool.has(ev.schoolId))
      .map(ev => ({ ev, s: preferenceScore(student, schoolsById.get(ev.schoolId)!) }))
      .filter(x => x.s > -500) // hard region exclusions
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map(x => x.ev);
  };

  if (poolIds.length > 0) {
    // The student's list IS the list. Analyze all of it; suggest additions
    // only where coverage is thin enough to create structural risk.
    const pool = new Set(poolIds);
    const selected = sortEvals(poolIds.map(id => evalById.get(id)).filter((e): e is SchoolEvaluation => !!e));
    const count = (b: 'reach' | 'match' | 'safety') => selected.filter(e => e.uiBucket === b).length;
    const suggestions = sortEvals([
      ...pickOutside(pool, 'safety', count('safety') < 2 ? targets.safety - count('safety') : 0),
      ...pickOutside(pool, 'match', count('match') < 2 ? targets.match - count('match') : 0),
    ]);
    return { selected, suggestions, targets, unmatchedPreferred: unmatched };
  }

  // No stated list: engine constructs one from scratch.
  const none = new Set<string>();
  return {
    selected: sortEvals([
      ...pickOutside(none, 'reach', targets.reach),
      ...pickOutside(none, 'match', targets.match),
      ...pickOutside(none, 'safety', targets.safety),
    ]),
    suggestions: [],
    targets,
    unmatchedPreferred: unmatched,
  };
}

/* ── Portfolio summary ─────────────────────────────────────── */

function bandMid(ev: SchoolEvaluation): number {
  return (ev.band.min + ev.band.max) / 200; // as probability
}

const LEVELS = ['Low', 'Medium-Low', 'Medium', 'Medium-High', 'High', 'Very High'] as const;

function levelFromTierAvg(avg: number): string {
  // avg is a mean tierIndex (0..4)
  if (avg >= 3.4) return 'Very High';
  if (avg >= 2.6) return 'High';
  if (avg >= 1.8) return 'Medium-High';
  if (avg >= 1.2) return 'Medium';
  if (avg >= 0.6) return 'Medium-Low';
  return 'Low';
}

export function summarizePortfolio(
  selected: SchoolEvaluation[],
  allEvaluations: SchoolEvaluation[],
  unmatchedPreferred: string[] = [],
): PortfolioSummary {
  const coverage = {
    reach: selected.filter(e => e.uiBucket === 'reach').length,
    match: selected.filter(e => e.uiBucket === 'match').length,
    safety: selected.filter(e => e.uiBucket === 'safety').length,
  };

  const mids = selected.map(bandMid);
  const upper = 1 - mids.reduce((acc, p) => acc * (1 - p), 1);
  const lower = mids.length ? Math.max(...mids) : 0;
  const lowerPct = Math.round(lower * 100);
  const upperPct = Math.round(upper * 100);

  const warnings: string[] = [];
  const hasAdmissionSafety = selected.some(e => tierIndex(e.tier) >= tierIndex('likely'));
  if (!hasAdmissionSafety) warnings.push('no_admission_safety');
  const gatedShare = selected.filter(e => e.baseRateUsed.scope === 'major' || e.flags.includes('major_locked')).length / Math.max(1, selected.length);
  if (gatedShare > 0.6) warnings.push('concentrated_in_gated_majors');
  if (selected.some(e => e.flags.includes('no_intl_need_aid'))) warnings.push('financial_safety_unknown');
  if (unmatchedPreferred.length) warnings.push('unmatched_preferred_schools');

  const shutoutRisk: PortfolioSummary['shutoutRisk'] =
    !hasAdmissionSafety && lowerPct < 40 ? 'critical'
    : !hasAdmissionSafety ? 'high'
    : lowerPct < 50 ? 'moderate'
    : 'low';

  const avgTier = (rankCap: number) => {
    const pool = allEvaluations.filter(e => e.ranking <= rankCap);
    if (!pool.length) return 0;
    return pool.reduce((a, e) => a + tierIndex(e.tier), 0) / pool.length;
  };

  return {
    pAtLeastOne: {
      lowerPct,
      upperPct,
      note: 'Range spans fully-correlated to independent admission outcomes; selective schools evaluate similar criteria, so the truth sits between these bounds.',
    },
    coverage,
    shutoutRisk,
    warnings,
    competitivenessLevels: {
      top10: levelFromTierAvg(avgTier(10)),
      top20: levelFromTierAvg(avgTier(20)),
      top50: levelFromTierAvg(avgTier(50)),
    },
    unmatchedPreferred,
  };
}

/* ── Entry point ───────────────────────────────────────────── */

export interface EngineResult {
  evaluations: SchoolEvaluation[];
  selected: SchoolEvaluation[];
  suggestions: SchoolEvaluation[];
  portfolio: PortfolioSummary;
  targets: PortfolioTargets;
}

export function runEngine(student: Student, assessment: ProfileAssessment, schools: School[]): EngineResult {
  const nums = extractStudentNumbers(student);
  const evaluations = schools.map(s => evaluateSchool(student, nums, assessment, s));
  const byId = new Map(schools.map(s => [s.id, s]));
  const { selected, suggestions, targets, unmatchedPreferred } = selectPortfolio(student, evaluations, byId);
  const portfolio = summarizePortfolio(selected, evaluations, unmatchedPreferred);
  return { evaluations, selected, suggestions, portfolio, targets };
}

export { LEVELS };
