/**
 * Blueprint Method™ — data contract for the six-volume strategy book.
 *
 * The Blueprint is NOT an essay generator. It is an identity, positioning, and
 * decision system. This module defines the shape of a generated Blueprint plus
 * the honesty vocabulary that every claim must carry.
 *
 * Design rules (mirror the rest of lib/admissions):
 *  - Numeric authority stays in engine.ts. This layer never invents a
 *    probability, ranking, or metric — it wraps prose in an evidence label.
 *  - Every application-relevant statement is a {@link Claim}: text + status +
 *    (for anything not yet Confirmed) the action needed before it can be
 *    submitted. Nothing marked `verify` may enter an application unchanged.
 *  - Individual contribution is always distinguished from team outcome.
 *
 * Reference case: Ethan Li — Blueprint No.001.
 */

import type { Tier, TierBand, ConfidenceLevel } from './definitions';
import type { FitLevel } from './schoolMatch';

/* ── Honesty vocabulary ────────────────────────────────────────
 * The four operational labels that decide whether a statement can enter an
 * application. Ordered strongest → weakest. A Blueprint becomes MORE precise
 * with each review: `verify`/`working_hypothesis` items are resolved into
 * `confirmed`, never the reverse.
 */
export const CLAIM_STATUS_ORDER = [
  'confirmed',           // supported by transcript, paper, certificate, or other document
  'family_confirmed',    // reported by student/family; supporting artifact still needed
  'working_hypothesis',  // strategic interpretation to validate with the student
  'verify',              // do NOT submit until title / hours / metric / role is checked
] as const;
export type ClaimStatus = (typeof CLAIM_STATUS_ORDER)[number];

export const CLAIM_STATUS_META: Record<ClaimStatus, {
  label: string;
  description: string;
  /** May this statement appear in an application as written? */
  submittable: boolean;
}> = {
  confirmed:          { label: 'Confirmed',          description: 'Supported by a transcript, resume, research paper, or other document.', submittable: true },
  family_confirmed:   { label: 'Family-confirmed',   description: 'Reported by the student or family; supporting artifact still needed.',  submittable: false },
  working_hypothesis: { label: 'Working hypothesis', description: 'Strategic interpretation to validate with the student.',                submittable: false },
  verify:             { label: 'Verify',             description: 'Do not submit until title, hours, metrics, or role is checked.',        submittable: false },
};

/** True for statuses that must be surfaced in the Master Claim Register. */
export function needsVerification(status: ClaimStatus): boolean {
  return status !== 'confirmed';
}

/**
 * The atomic honesty-labeled statement. Prose the reader sees, plus the
 * evidence status and — when not yet Confirmed — the concrete next action.
 */
export interface Claim {
  text: string;
  status: ClaimStatus;
  /** For any non-Confirmed claim: what must happen before it can be submitted. */
  verifyAction?: string;
  /** Optional evidence pointer (URL, certificate name, mentor). */
  source?: string;
}

/* ── Volume I · Identity ───────────────────────────────────────
 * Who is the student, before any activity is listed? The internal anchor;
 * school-specific language adapts but this logic stays stable.
 */
export interface OperatingSystemStage {
  /** e.g. "Input", "Processing", "Output", "Purpose". */
  stage: string;
  description: string;
}

export interface BrandTrait {
  /** e.g. "Curiosity", "Engineering", "Product", "Rigor", "Impact". */
  trait: string;
  /** The internal question the trait answers, e.g. "How does this system work?" */
  internalQuestion: string;
  /** Evidence that validates the trait — labeled, since some is still a hypothesis. */
  evidence: Claim;
}

export interface GrowthStage {
  label: string;
  description: string;
}

export interface IdentityVolume {
  /** Memorable, evidence-based, durable role — e.g. "Technology-to-Product Builder". */
  coreIdentity: string;
  /** The repeatable process the student performs unusually well — e.g. "Technology Translator". */
  distinctiveCapability: string;
  /** Third-person positioning statement — the stable internal anchor. */
  positioningStatement: Claim;
  /** First-person draft the student MUST edit; never used verbatim. */
  firstPersonDraft: string;
  intrinsicMotivation: string;
  craft: string;
  purpose: string;
  /** What the identity deliberately avoids claiming ("Not future CEO", …). */
  avoids: string[];
  /** Input → Processing → Output → Purpose. Requires ≥3 experiences or it is a hypothesis. */
  operatingSystem: OperatingSystemStage[];
  /** Five traits that recur across the strongest evidence. */
  brandDna: BrandTrait[];
  /** Progression in complexity/responsibility — not a pile of activities. */
  growthJourney: GrowthStage[];
}

/* ── Volume II · Evidence ──────────────────────────────────────
 * What is fact and what is interpretation? Every major claim should be
 * supported by at least one item from each of the three pillars.
 */
export interface AcademicSignal {
  dimension: string;
  evidence: string;
  strategicMeaning: string;
  status: ClaimStatus;
}

export interface EvidencePillar {
  /** "Technical proof" | "Human usefulness" | "Intellectual range". */
  pillar: string;
  proves: string;
  primaryEvidence: string[];
  /** What is still missing before this pillar is application-ready. */
  currentGap: string;
}

export interface CaseStudyLayer {
  /** "Problem" | "System" | "Evaluation" | "Recognition", etc. */
  layer: string;
  evidence: string;
  demonstrates: string;
  status: ClaimStatus;
}

export interface CaseStudyUse {
  /** Application context, e.g. "NYU BTE", "Cornell Engineering", "Common App", "Interview". */
  context: string;
  angle: string;
}

/** A project turned from a résumé line into evidence of how the student thinks. */
export interface ProjectCaseStudy {
  /** Links back to Student.projects[].id when derived from a real project. */
  projectId?: string;
  name: string;
  /** One-line "what it demonstrates". */
  headline: string;
  layers: CaseStudyLayer[];
  strategicMeaning: string;
  /** VERIFY items — individual contribution, metric methodology, official proof. */
  verifyGaps: Claim[];
  bestUses: CaseStudyUse[];
}

export interface RangeItem {
  evidence: string;
  signal: string;
  useInApplication: string;
}

export interface EvidenceVolume {
  academicFoundation: AcademicSignal[];
  /** Technical proof / human usefulness / intellectual range. */
  threePillars: EvidencePillar[];
  caseStudies: ProjectCaseStudy[];
  rangeEvidence: RangeItem[];
}

/* ── Volume III · Positioning ──────────────────────────────────
 * How the student differs from the relevant applicant archetype — including
 * risks, gaps, and tradeoffs, not only strengths.
 */
export interface ArchetypeRow {
  dimension: string;
  typicalProfile: string;
  thisStudent: string;
}

export interface RiskRow {
  area: string;
  assessment: string;
  risk: string;
  action: string;
  status: ClaimStatus;
}

export interface PositioningVolume {
  archetypeLabel: string;
  archetypeComparison: ArchetypeRow[];
  positioningDecision: string;
  strengthsGapsRisks: RiskRow[];
  /** The single most avoidable framing error and the stronger message. */
  mostImportantRisk: { risk: string; strongerMessage: string };
}

/* ── Volume IV · Future Self ───────────────────────────────────
 * A direction to test, not a prediction to perform.
 */
export interface DirectionItem {
  title: string;
  description: string;
}

export interface CapabilityGoal {
  capability: string;
  undergraduateGoal: string;
  evidenceByGraduation: string;
}

export interface FutureSelfVolume {
  futureIdentity: string;
  plausibleDirections: DirectionItem[];
  /** Directions explicitly NOT the current center of gravity. */
  notTheCenter: DirectionItem[];
  /** Ten-year learning agenda — capabilities outlast job titles. */
  learningAgenda: CapabilityGoal[];
}

/* ── Volume V · Program Fit ────────────────────────────────────
 * Evaluate at the program level, not only the university level. Numeric
 * authority (bands, tiers) comes from engine.ts — never regenerated here.
 */
export interface ProgramNeed {
  criterion: string;
  whyItMatters: string;
  minimumAcceptable: string;
}

export interface ProgramLandscapeGroup {
  /** "Integrated / dual degree" | "Business-first" | "Technology-first". */
  model: string;
  programs: string[];
  note?: string;
}

/** One row of the qualitative strategic fit matrix — tier words, never scores. */
export interface FitMatrixRow {
  program: string;
  schoolId?: string;
  technicalDepth: FitLevel;
  businessIntegration: FitLevel;
  productEcosystem: FitLevel;
  /** e.g. "Priority fit", "Aspirational fit", "Strong fit". */
  currentFit: string;
}

/** A year-by-year technical/product plan attached to a priority program. */
export interface ProgramYearPlan {
  year: 1 | 2 | 3 | 4;
  technicalAgenda: string;
  productBusinessAgenda: string;
  output: string;
}

export interface PriorityProgram {
  schoolId?: string;
  name: string;
  whyThesis: Claim;
  features: { feature: string; fit: string; caution: string }[];
  /** Optional deliberate depth plan (the BTE-style "keep building technically"). */
  depthPlan?: ProgramYearPlan[];
  /** The decision test the family must pass before committing (esp. binding ED). */
  decisionTest?: string;
}

export interface RoundRecommendation {
  /** "ED I" | "EA" | "REA" | "RD" | "Early nonbinding" | "RD portfolio". */
  round: string;
  schoolOrProgram: string;
  schoolId?: string;
  recommendation: string;
  condition: string;
}

export interface ProgramFitVolume {
  needs: ProgramNeed[];
  landscape: ProgramLandscapeGroup[];
  fitMatrix: FitMatrixRow[];
  priorityPrograms: PriorityProgram[];
  roundStrategy: RoundRecommendation[];
  bindingPrinciple: string;
}

/* ── Volume VI · Narrative System ──────────────────────────────
 * One stable core narrative with school-specific expressions. Never
 * contradictory identities for different schools.
 */
export interface SchoolEmphasis {
  context: string;
  emphasis: string;
  coreQuestion: string;
}

export interface CommonAppDirection {
  direction: string;
  possibleScene: string;
  reveals: string;
  risk: string;
}

export interface ActivityEntry {
  priority: number;
  activity: string;
  role: string;
  primarySignal: string;
  /** What must be nailed down before this entry is final. */
  neededBeforeFinal: string;
  status: ClaimStatus;
}

export interface RecommenderPlan {
  source: string;
  shouldEstablish: string;
  evidenceToProvide: string;
}

export interface NarrativeVolume {
  /** The master line, e.g. "Technology is the passion → productization is the craft → …". */
  masterLine: string;
  schoolEmphasis: SchoolEmphasis[];
  commonAppDirections: CommonAppDirection[];
  activitiesArchitecture: ActivityEntry[];
  resumeHeadline: string;
  recommendations: RecommenderPlan[];
  interviewStoryBank: string[];
}

/* ── Cross-cutting: executive overview, register, review ───────── */

export interface ExecutiveOverview {
  coreIdentity: string;
  primaryNarrative: string;
  bestFitModel: string;
  currentEarlyRecommendation: string;
  /** The single biggest strategic risk / guardrail. */
  guardrail: string;
}

/**
 * One entry in the Master Claim Register — every statement that is not yet
 * `confirmed`, auto-collected from across the six volumes so the family has a
 * single "must resolve before submission" checklist.
 */
export interface ClaimRegisterEntry {
  /** Where in the Blueprint the claim lives, e.g. "Evidence · SpeakWise". */
  location: string;
  claim: string;
  status: ClaimStatus;
  requiredAction: string;
  source?: string;
}

export interface Milestone {
  /** Week number or window label, e.g. "1", "3-4". */
  when: string;
  priority: string;
  deliverable: string;
}

/* ── Root document ─────────────────────────────────────────────── */

export const BLUEPRINT_VERSION = 1 as const;

/** One entry in the Blueprint's revision history — a working draft evolves, it is never "final". */
export interface BlueprintRevision {
  /** Draft label, e.g. "v0.1", "v0.2". */
  draftLabel: string;
  generatedAt: string;
  /** The working thesis at that revision, so the history reads as a trajectory. */
  thesis: string;
}

export interface Blueprint {
  version: typeof BLUEPRINT_VERSION;
  generatedAt: string;
  studentId: string;
  studentName: string;
  /** Every Blueprint is a WORKING DRAFT for family review — never final copy. */
  status: 'working_draft';
  /** Draft revision label surfaced in the header, e.g. "v0.2.1". */
  draftLabel: string;
  /** Ordered history of prior draft labels (oldest → newest), excluding the current one. */
  revisions?: BlueprintRevision[];
  /** One-line current working thesis. */
  thesis: string;
  executiveOverview: ExecutiveOverview;
  identity: IdentityVolume;
  evidence: EvidenceVolume;
  positioning: PositioningVolume;
  futureSelf: FutureSelfVolume;
  programFit: ProgramFitVolume;
  narrative: NarrativeVolume;
  /** Auto-derived from the six volumes; see {@link collectClaimRegister}. */
  claimRegister: ClaimRegisterEntry[];
  familyReviewQuestions: string[];
  next30Days: Milestone[];
  /** Optional pointer to the engine cycle/version that fed Volume V. */
  dataCycle?: string;
  engineVersion?: string;
}

/* ── Register collector ────────────────────────────────────────
 * Walks the generated volumes and pulls every non-Confirmed Claim into a
 * single register. Deterministic (code, not LLM) so the honesty checklist can
 * never silently drift from the prose it summarizes.
 */
export function collectClaimRegister(bp: Omit<Blueprint, 'claimRegister'>): ClaimRegisterEntry[] {
  const entries: ClaimRegisterEntry[] = [];
  const push = (location: string, c: Claim | undefined) => {
    if (!c || !needsVerification(c.status)) return;
    entries.push({
      location,
      claim: c.text,
      status: c.status,
      requiredAction: c.verifyAction ?? CLAIM_STATUS_META[c.status].description,
      source: c.source,
    });
  };

  // Volume I
  push('Identity · Positioning statement', bp.identity.positioningStatement);
  bp.identity.brandDna.forEach((t) => push(`Identity · Brand DNA (${t.trait})`, t.evidence));

  // Volume II
  bp.evidence.caseStudies.forEach((cs) => {
    cs.verifyGaps.forEach((g) => push(`Evidence · ${cs.name}`, g));
    cs.layers.forEach((l) =>
      needsVerification(l.status) &&
      entries.push({
        location: `Evidence · ${cs.name} (${l.layer})`,
        claim: l.evidence,
        status: l.status,
        requiredAction: CLAIM_STATUS_META[l.status].description,
      }),
    );
  });
  bp.evidence.academicFoundation.forEach((a) =>
    needsVerification(a.status) &&
    entries.push({
      location: `Evidence · Academic (${a.dimension})`,
      claim: a.evidence,
      status: a.status,
      requiredAction: CLAIM_STATUS_META[a.status].description,
    }),
  );

  // Volume III
  bp.positioning.strengthsGapsRisks.forEach((r) =>
    needsVerification(r.status) &&
    entries.push({
      location: `Positioning · ${r.area}`,
      claim: r.assessment,
      status: r.status,
      requiredAction: r.action,
    }),
  );

  // Volume V
  bp.programFit.priorityPrograms.forEach((p) => push(`Program Fit · ${p.name}`, p.whyThesis));

  // Volume VI
  bp.narrative.activitiesArchitecture.forEach((a) =>
    needsVerification(a.status) &&
    entries.push({
      location: `Narrative · Activity #${a.priority} (${a.activity})`,
      claim: `${a.role} — ${a.primarySignal}`,
      status: a.status,
      requiredAction: a.neededBeforeFinal,
    }),
  );

  return entries;
}

/** Re-export for convenience so downstream code has one import site. */
export type { Tier, TierBand, ConfidenceLevel, FitLevel };
