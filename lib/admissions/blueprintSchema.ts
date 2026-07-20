/**
 * Structured-output schema for the Blueprint "Identity Spine" generation call.
 *
 * Scope: Executive Overview + Volume I (Identity) + Volume III (Positioning)
 * + Volume IV (Future Self) + cross-cutting family questions / 30-day plan.
 * Volumes II (Evidence), V (Program Fit) and VI (Narrative) are populated by
 * later phases and assembled around this spine.
 *
 * Honesty rules are enforced two ways: the system prompt forbids inventing
 * facts, and every application-relevant statement carries a {@link ClaimStatus}.
 * Optional TS fields (Claim.verifyAction/source) are modeled as required
 * strings with an "empty string if N/A" convention — strict constrained
 * decoding dislikes optionals, and this mirrors lib/admissions/assessment.ts.
 */

import { z } from 'zod';
import { closeObjects } from './assessment';
import { CLAIM_STATUS_ORDER } from './blueprint';
import type {
  ExecutiveOverview,
  IdentityVolume,
  PositioningVolume,
  FutureSelfVolume,
  Milestone,
} from './blueprint';

const claimStatusSchema = z.enum(CLAIM_STATUS_ORDER);

const claimSchema = z.object({
  text: z.string().describe('The statement, in plain prose.'),
  status: claimStatusSchema.describe('confirmed = document-backed; family_confirmed = reported, artifact pending; working_hypothesis = interpretation to validate; verify = do not submit until checked.'),
  verifyAction: z.string().describe('For any non-confirmed claim: the concrete action needed before it can enter an application. Empty string if confirmed.'),
  source: z.string().describe('Evidence pointer (URL, certificate, mentor, document). Empty string if none.'),
});

/* ── Volume I · Identity ─────────────────────────────────────── */

const identitySchema = z.object({
  coreIdentity: z.string().describe('Memorable, evidence-based, durable role. Avoid "strong student" / "future leader". e.g. "Technology-to-Product Builder".'),
  distinctiveCapability: z.string().describe('The repeatable process the student performs unusually well, e.g. "Technology Translator".'),
  positioningStatement: claimSchema.describe('Third-person anchor statement. Usually a working_hypothesis until the student confirms it sounds like them.'),
  firstPersonDraft: z.string().describe('A first-person draft the STUDENT must edit; never used verbatim.'),
  intrinsicMotivation: z.string().describe('What the student pursues without external pressure.'),
  craft: z.string().describe('How motivation becomes output: engineering, research, design, writing, organizing, teaching, or entrepreneurship.'),
  purpose: z.string().describe('The human or societal value the student seeks to create — no inflated moral language.'),
  avoids: z.array(z.string()).min(1).describe('What this identity deliberately does NOT claim, each with a one-line reason, e.g. "Not future CEO — outcome claim without evidence."'),
  operatingSystem: z.array(z.object({
    stage: z.string().describe('Stage label: Input, Processing, Output, or Purpose.'),
    description: z.string(),
  })).min(1).describe('Input -> Processing -> Output -> Purpose. Must be supported by >=3 experiences or it is only a hypothesis.'),
  brandDna: z.array(z.object({
    trait: z.string().describe('e.g. Curiosity, Engineering, Product, Rigor, Impact.'),
    internalQuestion: z.string().describe('The internal question the trait answers, e.g. "How does this system work?"'),
    evidence: claimSchema.describe('Evidence validating the trait — labeled, since some is still a working hypothesis.'),
  })).min(1).describe('Five traits that recur across the strongest evidence.'),
  growthJourney: z.array(z.object({
    label: z.string(),
    description: z.string(),
  })).min(1).describe('Progression in complexity/responsibility — a coherent arc, not disconnected activities.'),
});

/* ── Volume III · Positioning ────────────────────────────────── */

const positioningSchema = z.object({
  archetypeLabel: z.string().describe('The relevant applicant archetype being compared against, e.g. "typical strong CS applicant".'),
  archetypeComparison: z.array(z.object({
    dimension: z.string(),
    typicalProfile: z.string(),
    thisStudent: z.string(),
  })).min(1).describe('How the student differs from the archetype across concrete dimensions.'),
  positioningDecision: z.string().describe('The competitive stance the student should take, in 2-3 sentences.'),
  strengthsGapsRisks: z.array(z.object({
    area: z.string(),
    assessment: z.string().describe('Current honest assessment of this area.'),
    risk: z.string().describe('How it could be misread or fall short.'),
    action: z.string().describe('The concrete action that resolves the risk.'),
    status: claimStatusSchema,
  })).min(1).describe('Strengths, gaps, and avoidable risks — the Blueprint must include tradeoffs, not only strengths.'),
  mostImportantRisk: z.object({
    risk: z.string().describe('The single most avoidable framing error.'),
    strongerMessage: z.string().describe('The message that should replace it.'),
  }),
});

/* ── Volume IV · Future Self ─────────────────────────────────── */

const futureSelfSchema = z.object({
  futureIdentity: z.string().describe('A plausible next identity to TEST, not a job title to perform.'),
  plausibleDirections: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).min(1),
  notTheCenter: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).min(1).describe('Directions explicitly NOT the current center of gravity, with why.'),
  learningAgenda: z.array(z.object({
    capability: z.string(),
    undergraduateGoal: z.string(),
    evidenceByGraduation: z.string(),
  })).min(1).describe('Ten-year capability agenda — capabilities outlast job titles.'),
});

/* ── Executive Overview + cross-cutting ──────────────────────── */

const executiveOverviewSchema = z.object({
  coreIdentity: z.string(),
  primaryNarrative: z.string().describe('The through-line of the student\'s work in 1-2 sentences.'),
  bestFitModel: z.string().describe('The academic model that best amplifies the identity.'),
  currentEarlyRecommendation: z.string().describe('Provisional early-round direction, framed as preference-based and conditional — never as a lock.'),
  guardrail: z.string().describe('The single biggest strategic risk to manage.'),
});

const milestoneSchema = z.object({
  when: z.string().describe('Week or window label, e.g. "1" or "3-4".'),
  priority: z.string(),
  deliverable: z.string(),
});

/* ── Full spine output ───────────────────────────────────────── */

export const blueprintSpineSchema = z.object({
  thesis: z.string().describe('One-line current working thesis, e.g. "Technology is the passion; productization the craft; impact the purpose."'),
  executiveOverview: executiveOverviewSchema,
  identity: identitySchema,
  positioning: positioningSchema,
  futureSelf: futureSelfSchema,
  familyReviewQuestions: z.array(z.string()).min(1).describe('Direct questions the student/family should answer to make the next version more true. Prioritize identity and motivation.'),
  next30Days: z.array(milestoneSchema).min(1).describe('Concrete deliverables that convert the Blueprint from hypothesis into evidence-backed document.'),
});

export type BlueprintSpineOutput = z.infer<typeof blueprintSpineSchema>;

/** Compile-time guarantee that the spine shapes match the Blueprint contract. */
const _typecheck = (s: BlueprintSpineOutput): {
  executiveOverview: ExecutiveOverview;
  identity: IdentityVolume;
  positioning: PositioningVolume;
  futureSelf: FutureSelfVolume;
  next30Days: Milestone[];
} => ({
  executiveOverview: s.executiveOverview,
  identity: s.identity,
  positioning: s.positioning,
  futureSelf: s.futureSelf,
  next30Days: s.next30Days,
});
void _typecheck;

/** JSON Schema for the forced tool call (zod v4 native conversion, objects closed). */
export function blueprintSpineJsonSchema() {
  return closeObjects(z.toJSONSchema(blueprintSpineSchema, { target: 'draft-7', io: 'input' })) as Record<string, unknown>;
}
