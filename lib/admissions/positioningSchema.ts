/**
 * Structured-output schema for Stage-1 positioning hypotheses.
 *
 * The model proposes 3–5 evidence-backed identity hypotheses (it does NOT pick
 * one) so the student can validate and converge. Run NON-strict — the array of
 * rich objects would exceed the strict grammar-size limit; zod safeParse +
 * retry enforces conformance. The route assigns stable ids.
 */

import { z } from 'zod';
import { closeObjects } from './assessment';
import { HYPOTHESIS_KIND_ORDER } from './journey';

const confidenceSchema = z.enum(['high', 'medium', 'low']);

const hypothesisSchema = z.object({
  kind: z.enum(HYPOTHESIS_KIND_ORDER)
    .describe('core_fit = most directly consistent with evidence; strategic_adjacent = valid alternate reading, often a less-crowded field; interdisciplinary = scarcer crossover; exploratory = real potential but immature evidence.'),
  label: z.string().describe('One-line positioning, e.g. "Technology-to-Product Builder". Specific to THIS student, not generic.'),
  supportingEvidence: z.array(z.string()).min(1).describe('Specific citations from the profile that support this reading.'),
  missingEvidence: z.array(z.string()).describe('What is still missing before this positioning is fully supported.'),
  narrativeRisk: z.string().describe('How this positioning could be misread or fall short in an application.'),
  confidence: confidenceSchema.describe('Your confidence that the evidence supports this hypothesis.'),
  fieldTypes: z.array(z.string()).min(1).describe('Academic fields / program types this positioning naturally leads to.'),
  careerPaths: z.array(z.string()).describe('Plausible long-term directions this positioning serves.'),
});

export const positioningOutputSchema = z.object({
  hypotheses: z.array(hypothesisSchema).min(1)
    .describe('3–5 hypotheses. Include one core_fit; span strategic_adjacent / interdisciplinary / exploratory where the evidence allows. Never fewer than 3 unless the evidence is truly thin.'),
});
export type PositioningOutput = z.infer<typeof positioningOutputSchema>;

export function positioningJsonSchema() {
  return closeObjects(z.toJSONSchema(positioningOutputSchema, { target: 'draft-7', io: 'input' })) as Record<string, unknown>;
}
