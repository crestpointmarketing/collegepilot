/**
 * Blueprint Journey™ — foundation data models.
 *
 * The product flow is Evidence → Identity → Direction → Program → Portfolio →
 * Blueprint. This module defines the three contracts every stage hangs on:
 *
 *  1. EvidenceStatus  — Stage 0: how trustworthy is each objective fact?
 *  2. PositioningHypothesis + validation — Stage 1: identity is a hypothesis
 *     the STUDENT confirms, never an AI verdict.
 *  3. ApplicationPathway — the real unit a family finally chooses:
 *     University → College → Program → Round (not just a school name).
 *
 * Numeric authority stays in engine.ts; fit and leverage are tier words, never
 * fabricated 0–100 scores or unpublished "admit rates".
 */

import type { ConfidenceLevel, Tier } from './definitions';
import type { FitLevel } from './schoolMatch';

/* ── Stage 0 · Evidence status ─────────────────────────────────
 * We are not an admissions office and cannot verify anything, so displaying a
 * system-asserted "verified" would be dishonest. The only real signal is the
 * user's own confirmation. Everything the family enters is taken as accurate
 * by default; they simply self-confirm it. "Planned" is kept because presenting
 * a not-yet-happened item as done is a genuine downstream honesty risk.
 *
 * (The Blueprint's own AI honesty labels — interpretation vs stated fact,
 * unverified metric — live in ClaimStatus at generation time, not here.)
 */
export const EVIDENCE_STATUS_ORDER = [
  'provided',  // entered by the student/family, taken as accurate; not yet self-confirmed
  'confirmed', // the student/family has confirmed this is accurate
  'planned',   // hasn't happened yet — a future or in-progress item
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUS_ORDER)[number];

/** Default for anything the family enters — trusted, awaiting self-confirmation. */
export const DEFAULT_EVIDENCE_STATUS: EvidenceStatus = 'provided';

export const EVIDENCE_STATUS_META: Record<EvidenceStatus, {
  label: string;
  description: string;
  /** True once the family has attested it is accurate. */
  confirmed: boolean;
}> = {
  provided:  { label: 'Provided',  description: 'Entered by the student or family and taken as accurate — not yet self-confirmed.', confirmed: false },
  confirmed: { label: 'Confirmed', description: 'The student or family has confirmed this is accurate.',                             confirmed: true },
  planned:   { label: 'Planned',   description: "Hasn't happened yet — a future or in-progress item.",                              confirmed: false },
};

/* ── Stage 1 · Positioning hypotheses + student validation ─────
 * The system proposes 3–5 evidence-backed identities; the student reacts to
 * each; the result converges to one Primary (+ Secondary / Explore).
 */
export const HYPOTHESIS_KIND_ORDER = [
  'core_fit',           // most directly consistent with current evidence
  'strategic_adjacent', // another valid reading, possibly a friendlier field
  'interdisciplinary',  // combines strengths into a scarcer crossover
  'exploratory',        // evidence immature but real potential
] as const;
export type HypothesisKind = (typeof HYPOTHESIS_KIND_ORDER)[number];

export const HYPOTHESIS_KIND_META: Record<HypothesisKind, { label: string; blurb: string }> = {
  core_fit:           { label: 'Core Fit',           blurb: 'Most directly consistent with the evidence.' },
  strategic_adjacent: { label: 'Strategic Adjacent', blurb: 'A valid alternate reading — often a less-crowded field.' },
  interdisciplinary:  { label: 'Interdisciplinary',  blurb: 'Combines strengths into a scarcer crossover identity.' },
  exploratory:        { label: 'Exploratory',        blurb: 'Evidence is still forming, but the potential is real.' },
};

export interface PositioningHypothesis {
  id: string;
  kind: HypothesisKind;
  /** One-line positioning, e.g. "Technology-to-Product Builder". */
  label: string;
  supportingEvidence: string[];
  /** What is still missing before this positioning is fully supported. */
  missingEvidence: string[];
  narrativeRisk: string;
  /** The AI's confidence in the hypothesis (reuses the engine vocabulary). */
  confidence: ConfidenceLevel;
  /** Academic fields/program types this positioning naturally leads to. */
  fieldTypes: string[];
  careerPaths: string[];
}

export const STUDENT_REACTION_ORDER = ['feels_like_me', 'partly', 'not_me', 'explore'] as const;
export type StudentReaction = (typeof STUDENT_REACTION_ORDER)[number];

export const STUDENT_REACTION_META: Record<StudentReaction, { label: string }> = {
  feels_like_me: { label: 'This feels like me' },
  partly:        { label: 'Partly me' },
  not_me:        { label: 'Not me' },
  explore:       { label: 'I want to explore this' },
};

export interface HypothesisValidation {
  hypothesisId: string;
  reaction: StudentReaction;
  note?: string;
}

export const DIRECTION_ROLE_ORDER = ['primary', 'secondary', 'exploratory'] as const;
export type DirectionRole = (typeof DIRECTION_ROLE_ORDER)[number];

/** The student's confirmed convergence: which hypothesis plays which role. */
export interface ConfirmedDirection {
  hypothesisId: string;
  role: DirectionRole;
}

/**
 * A convergence is valid only with exactly one Primary and at most one
 * Secondary — enforcing "one core identity + adjacent expressions", never
 * five parallel personas.
 */
export function isValidConvergence(dirs: ConfirmedDirection[]): boolean {
  const primary = dirs.filter(d => d.role === 'primary').length;
  const secondary = dirs.filter(d => d.role === 'secondary').length;
  return primary === 1 && secondary <= 1;
}

/**
 * The persisted Stage-1 state, stored on the Student. Generated hypotheses +
 * the student's reactions + the confirmed convergence. The Blueprint Seed is
 * built FROM `confirmed`, so identity reflects what the student validated —
 * never an AI decree.
 */
export interface PositioningState {
  generatedAt: string;
  hypotheses: PositioningHypothesis[];
  validations: HypothesisValidation[];
  confirmed: ConfirmedDirection[];
}

/** True once the student has a valid convergence (one primary, ≤1 secondary). */
export function isPositioningConfirmed(p: PositioningState | undefined): boolean {
  return !!p && p.confirmed.length > 0 && isValidConvergence(p.confirmed);
}

/* ── Stage 3–5 · Application Pathway ───────────────────────────
 * The unit of choice. Surfaces the Application Unit (what you actually apply
 * to) because it changes the whole strategy.
 */
export const APPLICATION_UNIT_ORDER = [
  'university',      // admitted to the university, declare major later
  'college',         // admitted to a college/school within the university
  'school',          // (alias for a named school, e.g. Stern)
  'department',      // admitted to a department
  'direct_major',    // direct-admit to the major
  'special_program', // a named cohort/dual-degree program
] as const;
export type ApplicationUnit = (typeof APPLICATION_UNIT_ORDER)[number];

export const APPLICATION_UNIT_META: Record<ApplicationUnit, { label: string }> = {
  university:      { label: 'University-wide' },
  college:         { label: 'College / school' },
  school:          { label: 'Named school' },
  department:      { label: 'Department' },
  direct_major:    { label: 'Direct-admit major' },
  special_program: { label: 'Special program / cohort' },
};

export const APPLICATION_ROUND_ORDER = ['ED', 'ED2', 'EA', 'REA', 'RD', 'rolling'] as const;
export type ApplicationRound = (typeof APPLICATION_ROUND_ORDER)[number];

/** Portfolio balancing role — distinct from the engine tier. */
export const PATHWAY_ROLE_ORDER = ['high_reach', 'reach', 'target', 'likely'] as const;
export type PathwayRole = (typeof PATHWAY_ROLE_ORDER)[number];

export type CostFit = 'affordable' | 'stretch' | 'unknown';
export type TransferRisk = 'low' | 'moderate' | 'high';

/**
 * University → College → Program → Round, plus the two separate axes (Fit vs
 * Relative Admissions Leverage, both tiers) and the practical fields a family
 * weighs. `status` flags whether the program-level data is document-backed or
 * an estimate that must be verified against the official program page.
 */
export interface ApplicationPathway {
  id: string;
  /** Links to lib/schools SCHOOLS[].id. */
  schoolId: string;
  university: string;
  /** e.g. "Stern School of Business", "College of Engineering". */
  college?: string;
  /** e.g. "Khubani BTE", "Computer Science". */
  program: string;
  applicationUnit: ApplicationUnit;
  round: ApplicationRound;
  /** Which confirmed direction (Stage 2) this pathway serves. */
  directionRole?: DirectionRole;
  /** Interest/evidence/trajectory match — tier word, never a score. */
  fit: FitLevel;
  /** Relative Admissions Leverage — tier word. NOT an admit-rate number. */
  admissionsLeverage: FitLevel;
  /** Difficulty tier from the deterministic engine, when available. */
  admissionTier?: Tier;
  role?: PathwayRole;
  transferRisk?: TransferRisk;
  narrativeAngle?: string;
  backup?: string;
  costFit?: CostFit;
  /** Provenance of the program-level facts behind this pathway. */
  status: EvidenceStatus;
}

/** "NYU · Stern · Khubani BTE · ED" — the human-readable pathway identity. */
export function pathwayLabel(p: ApplicationPathway): string {
  return [p.university, p.college, p.program, p.round]
    .filter((x): x is string => !!x && String(x).trim().length > 0)
    .join(' · ');
}

/* ── Stage 2 · Academic Direction ──────────────────────────────
 * From the confirmed identity, recommend major/program TYPES (no schools yet).
 * Fit and admissions leverage are SEPARATE tier axes — never 0–100 scores.
 */
export const DIRECTION_CATEGORY_ORDER = [
  'direct_fit',         // most natural expression of the identity
  'interdisciplinary',  // combines strengths into a scarcer crossover
  'strategic_adjacent', // a valid alternate angle, often a less-crowded field
  'not_recommended',    // inconsistent with the evidence/goals — with the reason
] as const;
export type DirectionCategory = (typeof DIRECTION_CATEGORY_ORDER)[number];

export const DIRECTION_CATEGORY_META: Record<DirectionCategory, { label: string; tag: string }> = {
  direct_fit:         { label: 'Direct fit',        tag: 'Primary Recommendation' },
  interdisciplinary:  { label: 'Interdisciplinary', tag: 'Interdisciplinary Advantage' },
  strategic_adjacent: { label: 'Strategic adjacent', tag: 'Strategic Alternative' },
  not_recommended:    { label: 'Not recommended',   tag: 'Not Recommended' },
};

export interface DirectionFitAxis {
  /** e.g. "Intellectual Fit", "Preparation", "Flexibility", "Portfolio Alignment". */
  label: string;
  level: FitLevel;
}

export interface AcademicDirection {
  id: string;
  /** The major / program type, e.g. "Computational Biology", "Business + Technology". */
  title: string;
  category: DirectionCategory;
  /** The evidence → identity → direction throughline. */
  chain: string;
  reason: string;
  /** Interest/evidence fit axes — tiers, never scores. */
  fitAxes: DirectionFitAxis[];
  overallFit: FitLevel;
  /** Relative Admissions Leverage — a tier, NOT an admit rate. */
  admissionsLeverage: FitLevel;
  adjacent: string[];
  preparationGaps: string[];
}

export interface DirectionSelection {
  directionId: string;
  role: DirectionRole;
}

export interface DirectionState {
  generatedAt: string;
  directions: AcademicDirection[];
  selected: DirectionSelection[];
}

/** Valid once the student has chosen exactly one primary direction. */
export function isDirectionConfirmed(d: DirectionState | undefined): boolean {
  return !!d && d.selected.filter(s => s.role === 'primary').length === 1;
}

/** Re-export the borrowed tier types so downstream has one import site. */
export type { ConfidenceLevel, Tier, FitLevel };
