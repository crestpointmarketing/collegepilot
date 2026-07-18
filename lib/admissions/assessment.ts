/**
 * Phase 1 — student profile layer.
 *
 * The LLM's ONLY quantitative job is qualitative grading: ten dimensions,
 * each with a tier, cited evidence, gaps, risks, verifiability and its own
 * confidence. It never outputs admit probabilities — those belong to the
 * deterministic engine.
 *
 * Student competitiveness (who they are) is deliberately separated from
 * application readiness (how done their materials are): a strong student
 * with unwritten essays is strong-but-unready, not weak.
 */

import { z } from 'zod';

export const DIMENSION_KEYS = [
  'academic_readiness',
  'curriculum_rigor_in_context',
  'major_preparation',
  'intellectual_vitality',
  'extracurricular_distinction',
  'leadership_impact',
  'narrative_coherence',
  'institutional_fit',
  'application_readiness',
  'financial_residency_context',
] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  academic_readiness: 'Academic Readiness',
  curriculum_rigor_in_context: 'Curriculum Rigor (School Context)',
  major_preparation: 'Major Preparation',
  intellectual_vitality: 'Intellectual Vitality',
  extracurricular_distinction: 'Extracurricular Distinction',
  leadership_impact: 'Leadership & Impact',
  narrative_coherence: 'Narrative Coherence',
  institutional_fit: 'Institutional Fit',
  application_readiness: 'Application Readiness',
  financial_residency_context: 'Financial & Residency Context',
};

const dimTierSchema = z.enum(['exceptional', 'strong', 'solid', 'developing', 'concern']);
export type DimTier = z.infer<typeof dimTierSchema>;

const confidenceSchema = z.enum(['high', 'medium', 'low']);

export const VERIFICATION_STATES = [
  'externally_verified',    // award result, publication, official record
  'institution_affiliated', // school/university/company confirms participation
  'link_verified',          // GitHub/site/demo link exists; impact not third-party-confirmed
  'self_reported_only',     // student's own account, no anchor
  'conflicting_or_incomplete', // materials disagree or key info missing
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

const dimensionAssessmentSchema = z.object({
  tier: dimTierSchema,
  evidence: z.array(z.string()).describe('Specific citations from the profile (name the course, project, award, metric).'),
  missing: z.array(z.string()).describe('Information that would change this grade if known.'),
  risks: z.array(z.string()).describe('Concrete risks an admissions officer would flag on this dimension.'),
  verifiability: z.enum(VERIFICATION_STATES)
    .describe('Strongest verification state the cited evidence supports. externally_verified = checkable result/record; institution_affiliated = named org confirms participation; link_verified = artifact URL exists but impact unconfirmed; self_reported_only = no anchor; conflicting_or_incomplete = materials disagree.'),
  confidence: confidenceSchema,
  reader_interpretation: z.string().describe("One sentence: how an admissions reader would interpret this dimension on a first pass."),
  overstatement_risk: z.enum(['low', 'medium', 'high'])
    .describe('Risk that the profile overstates this dimension relative to what evidence can support.'),
});
export type DimensionAssessment = z.infer<typeof dimensionAssessmentSchema>;

export const profileAssessmentSchema = z.object({
  dimensions: z.object(
    Object.fromEntries(DIMENSION_KEYS.map(k => [k, dimensionAssessmentSchema])) as Record<DimensionKey, typeof dimensionAssessmentSchema>,
  ),
  spike: z.object({
    has_spike: z.boolean(),
    domain: z.string().describe('The spike domain if any, e.g. "applied ML research"; empty string if none.'),
    summary: z.string().describe('2-3 sentences: what creates the spike, its depth, and how it differentiates vs the typical pool for this major.'),
  }),
  profile_read: z.string().describe("3-4 sentences written as an admissions officer's first-read impression: dominant narrative, the question the file raises, most compelling and most concerning element."),
  key_risks: z.array(z.string()).min(1).describe('Concrete, profile-specific risks. No generic advice.'),
  assessment_confidence: confidenceSchema.describe('Overall: is the profile complete enough to grade reliably?'),
  assessment_gaps: z.array(z.string()).describe('Profile information whose absence limits this assessment.'),
});
export type ProfileAssessment = z.infer<typeof profileAssessmentSchema>;

/**
 * Tool-facing variant: dimensions as an ARRAY of keyed entries instead of a
 * 10-key object. Constrained decoding compiles the schema to a grammar, and
 * ten duplicated sub-schemas blow past the size limit — one entry schema
 * with a key enum stays small. A refine + transform restores the record
 * shape, so callers only ever see ProfileAssessment.
 */
const dimensionEntrySchema = dimensionAssessmentSchema.extend({
  dimension: z.enum(DIMENSION_KEYS),
});

export const profileAssessmentSubmissionSchema = z.object({
  dimensions: z.array(dimensionEntrySchema).min(1)
    .describe('Exactly ten entries — one per dimension key, no repeats, none omitted.'),
  spike: profileAssessmentSchema.shape.spike,
  profile_read: profileAssessmentSchema.shape.profile_read,
  key_risks: profileAssessmentSchema.shape.key_risks,
  assessment_confidence: profileAssessmentSchema.shape.assessment_confidence,
  assessment_gaps: profileAssessmentSchema.shape.assessment_gaps,
})
  .refine(
    v => DIMENSION_KEYS.every(k => v.dimensions.some(d => d.dimension === k)),
    { message: `dimensions must contain one entry for every key: ${DIMENSION_KEYS.join(', ')}` },
  )
  .transform((v): ProfileAssessment => ({
    ...v,
    dimensions: Object.fromEntries(
      v.dimensions.map(({ dimension, ...rest }) => [dimension, rest]),
    ) as ProfileAssessment['dimensions'],
  }));

/**
 * Strict structured outputs require additionalProperties:false on every
 * object node; zod's io:'input' conversion leaves objects open. Close them.
 */
function closeObjects(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(closeObjects);
  if (node && typeof node === 'object') {
    const obj = { ...(node as Record<string, unknown>) };
    if (obj.type === 'object') obj.additionalProperties = false;
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'additionalProperties') obj[k] = closeObjects(v);
    }
    return obj;
  }
  return node;
}

/** JSON Schema for the forced tool call (zod v4 native conversion). */
export function profileAssessmentJsonSchema() {
  return closeObjects(z.toJSONSchema(profileAssessmentSubmissionSchema, { target: 'draft-7', io: 'input' })) as Record<string, unknown>;
}

/* ── Narrative layer output (step 3) ───────────────────────── */

/**
 * The narrative call explains computed results; it must not change them.
 * Anything numeric in here is a quote of engine output, injected by the
 * route — the schema deliberately contains no probability fields.
 */
export const narrativeOutputSchema = z.object({
  positioning: z.object({
    type: z.string().describe('Precise applicant archetype label.'),
    identity: z.string().describe('2-3 sentences, calibrated to actual profile strength.'),
    strengths: z.array(z.string()).min(1),
    weaknesses: z.array(z.string()).min(1),
  }),
  analysis: z.object({
    spike_assessment: z.string(),
    academic_rigor: z.string(),
    profile_read: z.string(),
    key_risks: z.string(),
  }),
  competitiveness_notes: z.object({
    top10: z.string().describe('2-3 sentences explaining the computed Top-10 level. Cite the specific drivers from the evaluations given to you.'),
    top20: z.string(),
    top50: z.string(),
    bullets: z.array(z.string()).min(1).describe('Portfolio-level insights. Reference tiers/bands only as given — never invent numbers.'),
  }),
  school_notes: z.array(z.object({
    school: z.string().describe('School short name EXACTLY as provided in the evaluation list.'),
    note: z.string().describe('2 sentences: (1) what pulls this student up at this school specifically, (2) what pulls them down. Ground in the trace factors provided.'),
  })),
  ed_ea_strategy: z.string().describe('Concrete early-round recommendation using the ED strategic value grades provided. Discuss leverage qualitatively — no invented percentage uplifts.'),
  narrative_direction: z.string().describe('3-4 sentences on essay angle. Name the specific story to tell.'),
  plan: z.array(z.object({
    month: z.string(),
    tasks: z.string(),
  })).min(1).describe('Deadline-driven execution plan. Work backward from early-round deadlines.'),
  meta_assessment: z.string().describe('1-2 sentences on portfolio aggressiveness and balance.'),
  levers: z.array(z.object({
    action: z.string().describe('Specific action, e.g. "Complete and publish the ML research project with measurable results".'),
    dimension: z.enum(DIMENSION_KEYS).describe('Which assessment dimension this improves.'),
    deadline: z.string().describe('When it must be done to matter, e.g. "before Aug 2026 (ED materials)".'),
    expected_effect: z.string().describe('Qualitative effect, e.g. "could move major_preparation from strong to exceptional, lifting tier at CS-gated schools". NEVER a percentage.'),
    evidence_required: z.string().describe('The artifact that proves completion, e.g. "mentor letter + public GitHub repo with commit history".'),
    material_served: z.string().describe('Which application material this feeds, e.g. "Activities list + Additional Information", "Why Major essays".'),
    rationale: z.string(),
  })).min(1),
});
export type NarrativeOutput = z.infer<typeof narrativeOutputSchema>;

export function narrativeOutputJsonSchema() {
  return closeObjects(z.toJSONSchema(narrativeOutputSchema, { target: 'draft-7' })) as Record<string, unknown>;
}

