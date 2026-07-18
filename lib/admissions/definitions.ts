/**
 * Phase 0 — canonical definitions for the admissions engine.
 *
 * Core product promise: explainable, auditable strategy — NOT precise
 * admit probabilities. Everything downstream (facts layer, rules engine,
 * UI) must express uncertainty through the vocabulary defined here.
 */

/* ── Tiers ─────────────────────────────────────────────────── */

/**
 * Counselor-style likelihood tiers. Wide bands by design: without
 * school-specific historical samples, anything narrower is false precision.
 */
export const TIER_ORDER = ['unlikely', 'reach', 'possible', 'likely', 'very_likely'] as const;
export type Tier = (typeof TIER_ORDER)[number];

export interface TierBand {
  /** Conservative lower bound, percent. */
  min: number;
  /** Upper bound, percent. */
  max: number;
}

export const TIER_META: Record<Tier, { label: string; band: TierBand; uiBucket: 'reach' | 'match' | 'safety' }> = {
  unlikely:    { label: 'Unlikely',    band: { min: 2,  max: 8 },  uiBucket: 'reach' },
  reach:       { label: 'Reach',       band: { min: 8,  max: 20 }, uiBucket: 'reach' },
  possible:    { label: 'Possible',    band: { min: 20, max: 45 }, uiBucket: 'match' },
  likely:      { label: 'Likely',      band: { min: 45, max: 70 }, uiBucket: 'safety' },
  very_likely: { label: 'Very Likely', band: { min: 70, max: 92 }, uiBucket: 'safety' },
};

export function tierIndex(t: Tier): number {
  return TIER_ORDER.indexOf(t);
}

/** Shift a tier by whole steps, clamped to [floor, ceiling]. */
export function shiftTier(t: Tier, steps: number, ceiling: Tier = 'very_likely', floor: Tier = 'unlikely'): Tier {
  const i = Math.min(
    tierIndex(ceiling),
    Math.max(tierIndex(floor), tierIndex(t) + steps),
  );
  return TIER_ORDER[i];
}

/**
 * Selectivity ceilings — no adjustment stack may push a student above
 * these, no matter how strong the profile. Mirrors real counselor practice
 * (nobody is "Likely" at a sub-8% school).
 */
export function selectivityCeiling(admitRatePct: number): { ceiling: Tier; reason: string } {
  if (admitRatePct < 8)  return { ceiling: 'reach',    reason: `Admit rate ${admitRatePct}% — sub-8% schools are never better than Reach for any applicant` };
  if (admitRatePct < 15) return { ceiling: 'possible', reason: `Admit rate ${admitRatePct}% — highly selective; capped at Possible` };
  if (admitRatePct < 30) return { ceiling: 'likely',   reason: `Admit rate ${admitRatePct}% — selective; capped at Likely` };
  return { ceiling: 'very_likely', reason: 'No selectivity cap' };
}

/** Base tier seeded purely from the admit rate bucket, before adjustments. */
export function baseTierFromAdmitRate(admitRatePct: number): Tier {
  if (admitRatePct < 8)  return 'unlikely';
  if (admitRatePct < 15) return 'reach';
  if (admitRatePct < 30) return 'possible';
  if (admitRatePct < 50) return 'likely';
  return 'very_likely';
}

/* ── Confidence ────────────────────────────────────────────── */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export const CONFIDENCE_ORDER: ConfidenceLevel[] = ['low', 'medium', 'high'];

export function minConfidence(...levels: ConfidenceLevel[]): ConfidenceLevel {
  return levels.reduce((a, b) => (CONFIDENCE_ORDER.indexOf(b) < CONFIDENCE_ORDER.indexOf(a) ? b : a), 'high');
}

/* ── Evidence provenance ───────────────────────────────────── */

/**
 * Fixed priority, high → low. "Official facts" and "strategic judgment"
 * must never be conflated: the last two types are judgment, not fact.
 */
export const SOURCE_PRIORITY = [
  'official_program', // program/department-published data
  'cds_official',     // Common Data Set / institution-wide official data
  'state_data',       // state-system public data
  'hs_history',       // sending high school's historical results (Naviance-style)
  'third_party',      // aggregators, journalism, applicant-community data
  'expert_estimate',  // counselor judgment — labeled as such, never as fact
] as const;
export type SourceType = (typeof SOURCE_PRIORITY)[number];

export interface EvidenceMeta {
  sourceType: SourceType;
  sourceUrl?: string;
  /** Admissions cycle the datum describes, e.g. "2024-25". */
  admissionCycle: string;
  /** ISO date the datum was recorded/reviewed. */
  retrievedAt: string;
  confidence: ConfidenceLevel;
  /** True when the value is inferred/estimated rather than published. */
  isEstimated: boolean;
  /** Scope of the datum. */
  appliesTo: 'institution' | 'college' | 'major' | 'program';
  /** Free-text caveat, e.g. "verify against official page before the 2026-27 cycle". */
  note?: string;
  /** Set when a policy change replaced this record. */
  supersededBy?: string;
}

export interface Fact<T> {
  value: T;
  meta: EvidenceMeta;
}

/* ── School policy vocabulary ──────────────────────────────── */

export type TestPolicy = 'required' | 'optional' | 'blind' | 'flexible';

export type EarlyRoundType = 'ED' | 'ED1_ED2' | 'EA' | 'REA' | 'EA_ED' | 'rolling' | 'none';

/**
 * ED strategic value — deliberately NOT a probability multiplier.
 * Published ED/RD rate gaps carry heavy selection bias (athletes, legacy,
 * development cases live in the ED pool), so we output a leverage grade
 * plus rationale instead of multiplying anything.
 */
export type EdStrategicValue = 'high_leverage' | 'moderate' | 'limited' | 'not_offered' | 'not_recommended';

export type MajorCompetitiveness = 'extreme' | 'high' | 'moderate' | 'standard';
export type TransferDifficulty = 'very_hard' | 'hard' | 'moderate' | 'open';

export interface MajorAdmissionFact {
  /** Program-specific admit rate where published/estimable, percent. */
  admitRatePct?: number;
  competitiveness: MajorCompetitiveness;
  /** True when students are admitted directly to the major/college. */
  directAdmit: boolean;
  /** How hard it is to transfer INTO this major after enrolling elsewhere in the university. */
  internalTransfer: TransferDifficulty;
}

/* ── Triple safety (Phase 2 contract, defined now) ─────────── */

/**
 * A school only counts as a true Safety when all three hold.
 * 'unknown' is a first-class value: "cannot reliably judge" must stay
 * distinct from "no".
 */
export interface SafetyCheck {
  /** Tier is likely/very_likely. */
  admissionSafety: boolean;
  /** Family can definitely afford it (aid policy × budget). */
  financialSafety: boolean | 'unknown';
  /** Student would genuinely attend. */
  personalSafety: boolean | 'unknown';
}

/* ── Shared trace vocabulary ───────────────────────────────── */

/** What kind of ground a rule stands on — surfaced in the audit trail. */
export type AdjustmentBasis = 'official_fact' | 'derived_stat' | 'llm_assessment' | 'policy_rule' | 'expert_estimate';

export interface AdjustmentRecord {
  ruleId: string;
  label: string;
  /** Whole tier steps; 0 = informational note that moved nothing. */
  stepDelta: number;
  rationale: string;
  basis: AdjustmentBasis;
  confidence: ConfidenceLevel;
}
