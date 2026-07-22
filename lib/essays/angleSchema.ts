/**
 * Structured-output schema for the Angle Miner (E2). Angles are directions to
 * test — the schema deliberately has NO field for draft prose, so the model
 * cannot return submission-ready text.
 */
import { z } from 'zod';
import { closeObjects } from '../admissions/assessment';

export const essayAngleSchema = z.object({
  angle: z.string().describe('One-line core angle — a direction to test, never a thesis statement to paste.'),
  personalEvidence: z.array(z.string()).min(1).describe('EXACT names of real profile items (activity position/org, project name, or award title) this angle draws on. Never invent one.'),
  schoolHook: z.string().describe('The specific school/program trait this angle answers, and why this prompt wants it.'),
  schoolHookStatus: z.enum(['verified', 'unverified']).describe('verified only if the trait comes from the provided school facts; otherwise unverified — the student must confirm it on the official page.'),
  masterLineLink: z.string().describe('How the angle expresses the confirmed identity / Blueprint master line.'),
  repetitionRisk: z.string().describe('Overlap risk with the Common App essay or sibling supplementals for the same school.'),
  clicheRisk: z.string().describe('How commonly admissions readers see this move, and what would make it generic.'),
  openQuestions: z.array(z.string()).min(1).describe('Questions the student must answer before this angle can carry an essay.'),
});

export const angleMinerOutputSchema = z.object({
  angles: z.array(essayAngleSchema).min(3).max(4),
});
export type AngleMinerOutput = z.infer<typeof angleMinerOutputSchema>;

export function angleMinerJsonSchema() {
  return closeObjects(z.toJSONSchema(angleMinerOutputSchema, { target: 'draft-7', io: 'input' })) as Record<string, unknown>;
}
