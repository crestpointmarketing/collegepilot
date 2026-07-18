import { z } from 'zod';
import type { Strategy, StrategyV2 } from '../types';

const schoolEntrySchema = z.object({
  name: z.string(),
  chance: z.string(),
  note: z.string(),
});

// The v2 fields the UI reads without optional chaining. Loose everywhere else.
const v2StructSchema = z.object({
  version: z.literal(2),
  generatedAt: z.string(),
  assessment: z.object({
    dimensions: z.record(z.string(), z.object({
      tier: z.string(),
      evidence: z.array(z.string()),
      missing: z.array(z.string()),
      risks: z.array(z.string()),
      verifiability: z.string(),
      confidence: z.string(),
    }).loose()),
    spike: z.object({ has_spike: z.boolean(), domain: z.string(), summary: z.string() }),
    profile_read: z.string(),
    key_risks: z.array(z.string()),
    assessment_confidence: z.string(),
    assessment_gaps: z.array(z.string()),
  }).loose(),
  evaluations: z.array(z.object({
    schoolId: z.string(),
    schoolName: z.string(),
    short: z.string(),
    ranking: z.number(),
    tier: z.string(),
    tierLabel: z.string(),
    band: z.object({ min: z.number(), max: z.number() }),
    uiBucket: z.enum(['reach', 'match', 'safety']),
    trace: z.array(z.object({
      ruleId: z.string(),
      label: z.string(),
      stepDelta: z.number(),
      rationale: z.string(),
      basis: z.string(),
      confidence: z.string(),
    }).loose()),
    dataConfidence: z.string(),
    assessmentConfidence: z.string(),
    flags: z.array(z.string()),
  }).loose()),
  portfolio: z.object({
    pAtLeastOne: z.object({ lowerPct: z.number(), upperPct: z.number(), note: z.string() }),
    coverage: z.object({ reach: z.number(), match: z.number(), safety: z.number() }),
    shutoutRisk: z.enum(['low', 'moderate', 'high', 'critical']),
    warnings: z.array(z.string()),
    competitivenessLevels: z.object({ top10: z.string(), top20: z.string(), top50: z.string() }),
  }).loose(),
  levers: z.array(z.object({
    action: z.string(),
    dimension: z.string(),
    deadline: z.string(),
    expected_effect: z.string(),
    rationale: z.string(),
  }).loose()),
}).loose();

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
  // Audit payload from the deterministic engine. Structural check covers the
  // fields the UI dereferences without guards; `.catch(undefined)` degrades a
  // malformed/older v2 payload to a plain v1 render instead of dropping the
  // whole strategy (or crashing a page).
  v2: v2StructSchema.optional().catch(undefined) as unknown as z.ZodType<StrategyV2 | undefined>,
});
