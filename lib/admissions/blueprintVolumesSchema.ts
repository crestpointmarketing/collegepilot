/**
 * Structured-output schema for the Blueprint "Volumes" generation call —
 * Volume II (Evidence), Volume V (Program Fit), Volume VI (Narrative System).
 *
 * This is the second Blueprint call, run after the identity spine. It is kept
 * separate so each call stays inside a workable token budget and so a failure
 * in one half never destroys the other (the route falls back to empty stubs).
 *
 * Honesty rules mirror the spine: no invented facts, no probabilities/rankings,
 * every application-relevant statement carries a {@link ClaimStatus}, and all
 * fit is a tier word (Excellent…Unknown), never a 0–100 score. Optional TS
 * fields are modeled with `.optional()` — this call is NON-strict (zod
 * safeParse + retry), so optionals need no grammar workaround.
 */

import { z } from 'zod';
import { closeObjects } from './assessment';
import { CLAIM_STATUS_ORDER } from './blueprint';
import type {
  EvidenceVolume,
  ProgramFitVolume,
  NarrativeVolume,
} from './blueprint';

/** Literal tuple so z.enum infers the FitLevel union (not bare `string`). */
const FIT_LEVELS = ['Excellent', 'Strong', 'Moderate', 'Limited', 'Unknown'] as const;

const claimStatusSchema = z.enum(CLAIM_STATUS_ORDER);
const fitLevelSchema = z.enum(FIT_LEVELS);

const claimSchema = z.object({
  text: z.string().describe('The statement, in plain prose.'),
  status: claimStatusSchema.describe('confirmed = document-backed; family_confirmed = reported, artifact pending; working_hypothesis = interpretation to validate; verify = do not submit until checked.'),
  verifyAction: z.string().describe('For any non-confirmed claim: the concrete action needed before it can enter an application. Empty string if confirmed.'),
  source: z.string().describe('Evidence pointer (URL, certificate, mentor, document). Empty string if none.'),
});

/* ── Volume II · Evidence ────────────────────────────────────── */

const evidenceSchema = z.object({
  academicFoundation: z.array(z.object({
    dimension: z.string().describe('e.g. "Mathematical rigor", "Research maturity", "Technical depth".'),
    evidence: z.string().describe('The specific course, score, paper, or project that shows it.'),
    strategicMeaning: z.string().describe('What this signals to an admissions reader.'),
    status: claimStatusSchema,
  })).min(1).describe('The academic signals that ground the profile.'),
  threePillars: z.array(z.object({
    pillar: z.string().describe('e.g. "Technical proof", "Human usefulness", "Intellectual range".'),
    proves: z.string().describe('What this pillar proves about the student.'),
    primaryEvidence: z.array(z.string()).min(1).describe('The strongest 1–3 evidence items for this pillar.'),
    currentGap: z.string().describe('What is still missing before this pillar is application-ready.'),
  })).min(1).describe('Ideally three pillars; every major claim should touch at least one.'),
  caseStudies: z.array(z.object({
    projectId: z.string().optional().describe('Links back to a real Student.projects[].id when derived from one.'),
    name: z.string(),
    headline: z.string().describe('One-line "what it demonstrates".'),
    layers: z.array(z.object({
      layer: z.string().describe('e.g. "Problem", "System", "Evaluation", "Recognition".'),
      evidence: z.string(),
      demonstrates: z.string(),
      status: claimStatusSchema,
    })).min(1),
    strategicMeaning: z.string(),
    verifyGaps: z.array(claimSchema).describe('VERIFY items — individual contribution, metric methodology, official proof. Empty array if none.'),
    bestUses: z.array(z.object({
      context: z.string().describe('Application context, e.g. "NYU BTE", "Common App", "Interview".'),
      angle: z.string(),
    })).min(1),
  })).describe('Projects turned from résumé lines into evidence of how the student thinks. Empty array only if there are truly no projects.'),
  rangeEvidence: z.array(z.object({
    evidence: z.string(),
    signal: z.string(),
    useInApplication: z.string(),
  })).describe('Breadth evidence (arts, writing, service, leadership). Empty array if none.'),
});

/* ── Volume V · Program Fit (qualitative — tiers, never scores) ── */

const programFitSchema = z.object({
  needs: z.array(z.object({
    criterion: z.string().describe('What a strong program in this direction requires of the applicant.'),
    whyItMatters: z.string(),
    minimumAcceptable: z.string().describe('The honest floor the student must clear.'),
  })).min(1),
  landscape: z.array(z.object({
    model: z.string().describe('e.g. "Integrated / dual degree", "Business-first", "Technology-first".'),
    programs: z.array(z.string()).min(1).describe('Program TYPES or named programs that fit this model.'),
    note: z.string().optional(),
  })).min(1).describe('The academic-model landscape for this student\'s direction.'),
  fitMatrix: z.array(z.object({
    program: z.string(),
    schoolId: z.string().optional(),
    technicalDepth: fitLevelSchema,
    businessIntegration: fitLevelSchema,
    productEcosystem: fitLevelSchema,
    currentFit: z.string().describe('e.g. "Priority fit", "Aspirational fit", "Strong fit" — a phrase, never a number.'),
  })).min(1).describe('Qualitative strategic-fit matrix. Every axis is a tier word.'),
  priorityPrograms: z.array(z.object({
    schoolId: z.string().optional(),
    name: z.string(),
    whyThesis: claimSchema.describe('Why this program is a priority — usually a working_hypothesis.'),
    features: z.array(z.object({
      feature: z.string(),
      fit: z.string(),
      caution: z.string(),
    })).min(1),
    decisionTest: z.string().optional().describe('The test the family must pass before committing (esp. binding ED).'),
  })).min(1).describe('The 2–4 programs worth deep investment.'),
  roundStrategy: z.array(z.object({
    round: z.string().describe('e.g. "ED I", "EA", "REA", "RD".'),
    schoolOrProgram: z.string(),
    schoolId: z.string().optional(),
    recommendation: z.string(),
    condition: z.string().describe('The condition under which the recommendation holds.'),
  })).min(1),
  bindingPrinciple: z.string().describe('The one rule that governs any binding-ED decision for this student.'),
});

/* ── Volume VI · Narrative System ────────────────────────────── */

const narrativeSchema = z.object({
  masterLine: z.string().describe('The single stable core narrative, e.g. "Technology is the passion → productization the craft → impact the purpose."'),
  schoolEmphasis: z.array(z.object({
    context: z.string().describe('School or program context.'),
    emphasis: z.string().describe('What to emphasize there — an expression of the ONE identity, never a contradictory persona.'),
    coreQuestion: z.string().describe('The core question that school is really asking.'),
  })).min(1),
  commonAppDirections: z.array(z.object({
    direction: z.string(),
    possibleScene: z.string().describe('A concrete scene the student could develop — never invented as fact.'),
    reveals: z.string(),
    risk: z.string(),
  })).min(1).describe('2–3 essay directions to test — directions, not written essays.'),
  activitiesArchitecture: z.array(z.object({
    priority: z.number().int().describe('1 = most important.'),
    activity: z.string(),
    role: z.string(),
    primarySignal: z.string().describe('The single strongest thing this entry signals.'),
    neededBeforeFinal: z.string().describe('What must be nailed down before this entry is final.'),
    status: claimStatusSchema,
  })).min(1).describe('The Common-App activities list, ordered and framed by signal.'),
  resumeHeadline: z.string(),
  recommendations: z.array(z.object({
    source: z.string().describe('Recommender type, e.g. "STEM teacher", "Research mentor", "Counselor".'),
    shouldEstablish: z.string().describe('What this letter should establish.'),
    evidenceToProvide: z.string().describe('What to give the recommender so they can write it credibly.'),
  })).min(1),
  interviewStoryBank: z.array(z.string()).min(1).describe('Short prompts for stories the student can tell in interviews — grounded in real evidence.'),
});

/* ── Full volumes output ─────────────────────────────────────── */

export const blueprintVolumesSchema = z.object({
  evidence: evidenceSchema,
  programFit: programFitSchema,
  narrative: narrativeSchema,
});

export type BlueprintVolumesOutput = z.infer<typeof blueprintVolumesSchema>;

/** Compile-time guarantee the volume shapes match the Blueprint contract. */
const _typecheck = (v: BlueprintVolumesOutput): {
  evidence: EvidenceVolume;
  programFit: ProgramFitVolume;
  narrative: NarrativeVolume;
} => ({
  evidence: v.evidence,
  programFit: v.programFit,
  narrative: v.narrative,
});
void _typecheck;

/** JSON Schema for the forced tool call (zod v4 native conversion, objects closed). */
export function blueprintVolumesJsonSchema() {
  return closeObjects(z.toJSONSchema(blueprintVolumesSchema, { target: 'draft-7', io: 'input' })) as Record<string, unknown>;
}
