/**
 * Structured-output schema for the Essay Review (E3). The shape deliberately
 * has NO field for rewritten text — the model can quote the student's own
 * sentences and ask questions, never supply replacement prose.
 */
import { z } from 'zod';
import { closeObjects } from '../admissions/assessment';

export const RUBRIC_DIMENSIONS = ['prompt_fit', 'specificity', 'student_voice', 'structure', 'ending_takeaway'] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];
export const RUBRIC_LABEL: Record<RubricDimension, string> = {
  prompt_fit: 'Prompt Fit',
  specificity: 'Specificity',
  student_voice: 'Student Voice',
  structure: 'Structure',
  ending_takeaway: 'Ending & Takeaway',
};

export const rubricRowSchema = z.object({
  dimension: z.enum(RUBRIC_DIMENSIONS),
  status: z.enum(['strong', 'adequate', 'weak']),
  quote: z.string().describe('A VERBATIM sentence or fragment from the student essay that best shows this dimension (copy exactly, no paraphrase).'),
  diagnosis: z.string().describe('What is working or failing in this dimension, grounded in the quote.'),
  revisionQuestion: z.string().describe('ONE question that would push the next draft forward. A question, never an instruction to replace text.'),
});

export const claimRowSchema = z.object({
  quote: z.string().describe('Verbatim claim from the essay.'),
  status: z.enum(['confirmed', 'needs_verification', 'unsupported', 'potentially_overstated']).describe('confirmed = matches the profile evidence; needs_verification = plausible but no artifact; unsupported = nothing in the profile backs it; potentially_overstated = the profile supports a weaker version.'),
  note: z.string().describe('Why it received this status, referencing the profile item or school fact involved.'),
});

export const essayReviewSchema = z.object({
  aoFirstRead: z.string().describe('2-4 sentences: the honest impression an admissions reader likely forms on a first pass. Not a verdict, not flattery.'),
  rubric: z.array(rubricRowSchema).length(5).describe('Exactly one row per dimension: prompt_fit, specificity, student_voice, structure, ending_takeaway.'),
  claims: z.array(claimRowSchema).describe('Every checkable factual claim in the essay. Empty array only if the essay makes none.'),
  revisionPriorities: z.array(z.string()).min(1).max(3).describe('The at-most-3 highest-impact things to fix next. Never more than 3.'),
  nextDraftQuestions: z.array(z.string()).min(1).describe('Questions whose ANSWERS become the next draft, e.g. "What changed in how you approached the problem after the first prototype failed?"'),
});
export type EssayReview = z.infer<typeof essayReviewSchema>;

export function essayReviewJsonSchema() {
  return closeObjects(z.toJSONSchema(essayReviewSchema, { target: 'draft-7', io: 'input' })) as Record<string, unknown>;
}
