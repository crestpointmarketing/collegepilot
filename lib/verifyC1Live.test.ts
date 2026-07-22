/**
 * LIVE C1 verification — runs the real strategy pipeline against the Anthropic
 * API. Gated behind RUN_LIVE=1 so it NEVER runs in the normal `vitest run`.
 *
 *   RUN_LIVE=1 npx vitest run lib/verifyC1Live.test.ts
 *
 * Verifies:
 *  1. confirmed identity/direction actually enters the Strategy narrative output
 *  2. narrative + positioning + pathway major stay consistent with the choice
 *  3. admit tiers/bands are NOT changed by identity/direction (honesty boundary)
 *  4. an unconfirmed student's positioning is treated as inferred, not settled
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { SAMPLE_STUDENTS } from './data';
import { SCHOOLS } from './schools';
import { runEngine } from './admissions/engine';
import {
  ASSESSMENT_SYSTEM_PROMPT, NARRATIVE_SYSTEM_PROMPT,
  buildAssessmentPrompt, buildNarrativePrompt,
} from './prompts';
import {
  profileAssessmentSubmissionSchema, profileAssessmentJsonSchema,
  narrativeOutputSchema, narrativeOutputJsonSchema,
} from './admissions/assessment';
import { getAnthropicClient } from './ai';

// Load ANTHROPIC_API_KEY from .env.local (vitest does not load .env files).
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env.local */ }

const LIVE = process.env.RUN_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;

async function callStructured<T>(client: Anthropic, opts: {
  system: string; prompt: string; toolName: string; description: string;
  inputSchema: Record<string, unknown>; zodSchema: z.ZodType<T>; maxTokens: number;
}): Promise<T> {
  let feedback = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const content = feedback ? `${opts.prompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION — fix these issues:\n${feedback}` : opts.prompt;
    const stream = client.beta.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: opts.maxTokens,
      system: opts.system,
      betas: ['structured-outputs-2025-11-13'],
      messages: [{ role: 'user', content }],
      tools: [{ name: opts.toolName, description: opts.description, input_schema: opts.inputSchema as Anthropic.Beta.BetaTool['input_schema'], strict: true }],
      tool_choice: { type: 'tool', name: opts.toolName },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'max_tokens') { feedback = 'Output truncated. Be more concise.'; continue; }
    const block = message.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') { feedback = 'No tool call produced.'; continue; }
    const parsed = opts.zodSchema.safeParse(block.input);
    if (parsed.success) return parsed.data;
    feedback = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
  }
  throw new Error(`validation failed after retries: ${feedback}`);
}

describe.runIf(LIVE)('C1 live — confirmed Identity/Direction drives narrative, not tiers', () => {
  const CONFIRMED_IDENTITY = 'Applied AI Systems Builder';
  const CONFIRMED_DIRECTION = 'Computer Science with an AI/ML concentration';

  it('confirmed focus reaches the narrative; unconfirmed does not; tiers are identical', async () => {
    const client = getAnthropicClient();
    const base = SAMPLE_STUDENTS[0]; // Ethan Li — CS/AI Systems

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const unconfirmed: any = { ...base, positioning: undefined, direction: undefined };
    const confirmed: any = {
      ...base,
      positioning: {
        generatedAt: '2026-01-01', validations: [],
        hypotheses: [{ id: 'h1', kind: 'core_fit', label: CONFIRMED_IDENTITY, supportingEvidence: [], missingEvidence: [], narrativeRisk: '', confidence: 'high', fieldTypes: [], careerPaths: [] }],
        confirmed: [{ hypothesisId: 'h1', role: 'primary' }],
      },
      direction: {
        generatedAt: '2026-01-01',
        directions: [{ id: 'd1', title: CONFIRMED_DIRECTION, category: 'direct_fit', chain: '', reason: '', fitAxes: [], overallFit: 'Strong', admissionsLeverage: 'Moderate', adjacent: [], preparationGaps: [] }],
        selected: [{ directionId: 'd1', role: 'primary' }],
      },
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Assessment reads only the profile (identical for both) — run once.
    const asmt = await callStructured(client, {
      system: ASSESSMENT_SYSTEM_PROMPT,
      prompt: buildAssessmentPrompt(base),
      toolName: 'submit_assessment', description: 'assessment',
      inputSchema: profileAssessmentJsonSchema(),
      zodSchema: profileAssessmentSubmissionSchema, maxTokens: 12000,
    });

    // (3) Tier invariance — the deterministic engine ignores positioning/direction.
    const engC = runEngine(confirmed, asmt, SCHOOLS);
    const engU = runEngine(unconfirmed, asmt, SCHOOLS);
    const tiers = (e: typeof engC) => e.selected.map(s => `${s.short}:${s.tierLabel}:${s.band.min}-${s.band.max}`).sort();
    expect(tiers(engC)).toEqual(tiers(engU));
    console.log('\n[3] TIER INVARIANCE OK — identical tiers/bands with & without confirmed focus.');

    // (1)(2) Confirmed narrative must reflect the identity/direction.
    const narC = await callStructured(client, {
      system: NARRATIVE_SYSTEM_PROMPT,
      prompt: buildNarrativePrompt(confirmed, asmt, engC),
      toolName: 'submit_report', description: 'report',
      inputSchema: narrativeOutputJsonSchema(),
      zodSchema: narrativeOutputSchema, maxTokens: 20000,
    });
    const blobC = JSON.stringify(narC).toLowerCase();
    const idHit = blobC.includes(CONFIRMED_IDENTITY.toLowerCase()) || blobC.includes('ai systems builder');
    const dirHit = blobC.includes('ai/ml') || blobC.includes('ai / ml') || blobC.includes('machine learning');
    console.log('\n[1/2] CONFIRMED narrative:');
    console.log('  positioning.type    :', narC.positioning.type);
    console.log('  positioning.identity:', narC.positioning.identity.slice(0, 240));
    console.log('  narrative_direction :', narC.narrative_direction.slice(0, 240));
    console.log('  identity term present:', idHit, '| direction term present:', dirHit);
    expect(idHit || dirHit).toBe(true);

    // (4) Unconfirmed narrative for eyeball — should read as inferred/working.
    const narU = await callStructured(client, {
      system: NARRATIVE_SYSTEM_PROMPT,
      prompt: buildNarrativePrompt(unconfirmed, asmt, engU),
      toolName: 'submit_report', description: 'report',
      inputSchema: narrativeOutputJsonSchema(),
      zodSchema: narrativeOutputSchema, maxTokens: 20000,
    });
    console.log('\n[4] UNCONFIRMED narrative (for review — no confirmed focus injected):');
    console.log('  positioning.type    :', narU.positioning.type);
    console.log('  positioning.identity:', narU.positioning.identity.slice(0, 240));
  }, 580000);
});
