import { z } from 'zod';
import type { Strategy } from '../types';

const schoolEntrySchema = z.object({
  name: z.string(),
  chance: z.string(),
  note: z.string(),
});

export const strategySchema: z.ZodType<Strategy> = z.object({
  analysis: z.object({
    spike_assessment: z.string(),
    academic_rigor: z.string(),
    profile_read: z.string(),
    key_risks: z.string(),
  }).optional(),
  positioning: z.object({
    type: z.string(),
    identity: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  }),
  competitiveness: z.object({
    top10: z.object({ level: z.string(), note: z.string() }),
    top20: z.object({ level: z.string(), note: z.string() }),
    top50: z.object({ level: z.string(), note: z.string() }),
    bullets: z.array(z.string()),
  }),
  schools: z.object({
    reach: z.array(schoolEntrySchema),
    match: z.array(schoolEntrySchema),
    safety: z.array(schoolEntrySchema),
  }),
  strategy: z.object({
    ed_ea: z.string(),
    narrative: z.string(),
  }),
  plan: z.array(z.object({ month: z.string(), tasks: z.string() })),
  meta: z.object({
    overall_success_probability: z.string(),
    assessment: z.string(),
    improvement_levers: z.array(z.string()),
  }).optional(),
});
