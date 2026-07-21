/**
 * Structured-output schema for Stage-2 academic direction.
 *
 * The model recommends major/program TYPES from the confirmed identity — no
 * schools. Fit and admissions leverage are separate TIER axes (never scores).
 * Run NON-strict (array of rich objects exceeds the strict grammar limit).
 */

import { z } from 'zod';
import { closeObjects } from './assessment';
import { DIRECTION_CATEGORY_ORDER } from './journey';

const fitLevel = z.enum(['Excellent', 'Strong', 'Moderate', 'Limited', 'Unknown']);

const fitAxisSchema = z.object({
  label: z.string().describe('Axis name: "Intellectual Fit", "Preparation", "Flexibility", or "Portfolio Alignment".'),
  level: fitLevel,
});

const directionSchema = z.object({
  title: z.string().describe('The major / program type, e.g. "Computational Biology", "Business + Technology". Specific to THIS student.'),
  category: z.enum(DIRECTION_CATEGORY_ORDER)
    .describe('direct_fit = most natural expression of the identity; interdisciplinary = scarcer crossover; strategic_adjacent = valid alternate angle, often less-crowded; not_recommended = inconsistent with the evidence, with the reason.'),
  chain: z.string().describe('The evidence → identity → direction throughline in one line.'),
  reason: z.string().describe('Why this direction fits (or, for not_recommended, why it does not).'),
  fitAxes: z.array(fitAxisSchema).min(1).describe('Exactly four axes: Intellectual Fit, Preparation, Flexibility, Portfolio Alignment — each a tier.'),
  overallFit: fitLevel,
  admissionsLeverage: fitLevel.describe('Relative Admissions Leverage — a tier reflecting differentiation and competition. NOT an admit rate.'),
  adjacent: z.array(z.string()).describe('Closely related majors/concentrations.'),
  preparationGaps: z.array(z.string()).describe('Coursework or evidence still needed to be competitive for this direction.'),
});

export const directionOutputSchema = z.object({
  directions: z.array(directionSchema).min(1)
    .describe('3–5 directions: one direct_fit, plus interdisciplinary / strategic_adjacent where the evidence allows, and at least one not_recommended with its reason.'),
});
export type DirectionOutput = z.infer<typeof directionOutputSchema>;

export function directionJsonSchema() {
  return closeObjects(z.toJSONSchema(directionOutputSchema, { target: 'draft-7', io: 'input' })) as Record<string, unknown>;
}
