/**
 * Debug step 3 only: fixture assessment → engine → narrative call.
 * Prints stop_reason and the raw tool input structure on failure.
 * Run: npx tsx --env-file=.env.local .smoke/narrative-debug.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { SAMPLE_STUDENTS } from '@/lib/data';
import { SCHOOLS } from '@/lib/schools';
import {
  DIMENSION_KEYS, narrativeOutputSchema, narrativeOutputJsonSchema, type ProfileAssessment,
} from '@/lib/admissions/assessment';
import { runEngine } from '@/lib/admissions/engine';
import { NARRATIVE_SYSTEM_PROMPT, buildNarrativePrompt } from '@/lib/prompts';

const MODEL = 'claude-sonnet-5';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const dim = (tier: 'exceptional' | 'strong' | 'solid' | 'developing', verifiability: 'externally_verified' | 'plausible' | 'self_reported_only' = 'plausible') => ({
  tier, evidence: ['Whisper-based speech pipeline with published latency benchmarks'], missing: [], risks: [],
  verifiability, confidence: 'medium' as const,
});

const assessment: ProfileAssessment = {
  dimensions: Object.fromEntries(DIMENSION_KEYS.map(k => [k, dim('strong')])) as ProfileAssessment['dimensions'],
  spike: { has_spike: true, domain: 'applied ML systems', summary: 'Production-grade ML engineering with verifiable artifacts.' },
  profile_read: 'Strong technical applicant with real systems work; essays unwritten.',
  key_risks: ['CS gating at publics', 'application readiness lagging'],
  assessment_confidence: 'medium',
  assessment_gaps: ['essay drafts not seen'],
};

async function main() {
  const student = SAMPLE_STUDENTS.find(s => s.name.includes('Ethan')) ?? SAMPLE_STUDENTS[0];
  const engine = runEngine(student, assessment, SCHOOLS);
  console.log(`Selected ${engine.selected.length} schools; prompt length: ${buildNarrativePrompt(student, assessment, engine).length} chars`);

  const stream = client.beta.messages.stream({
    model: MODEL, max_tokens: 20000, system: NARRATIVE_SYSTEM_PROMPT,
    betas: ['structured-outputs-2025-11-13'],
    messages: [{ role: 'user', content: buildNarrativePrompt(student, assessment, engine) }],
    tools: [{ name: 'submit_report', description: 'Submit the counselor strategy report.', input_schema: narrativeOutputJsonSchema() as never, strict: true }],
    tool_choice: { type: 'tool', name: 'submit_report' },
  });
  const msg = await stream.finalMessage();
  console.log(`stop_reason: ${msg.stop_reason} | usage: in=${msg.usage.input_tokens} out=${msg.usage.output_tokens}`);
  console.log(`content blocks: ${msg.content.map(b => b.type).join(', ')}`);
  const block = msg.content.find(b => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') { console.log('NO TOOL_USE BLOCK'); return; }
  const input = block.input as Record<string, unknown>;
  console.log(`tool input keys: ${Object.keys(input).join(', ')}`);
  const parsed = narrativeOutputSchema.safeParse(input);
  if (parsed.success) {
    console.log('PARSE OK — positioning.type =', parsed.data.positioning.type);
  } else {
    console.log('PARSE FAILED:', parsed.error.issues.slice(0, 4).map(i => `${i.path.join('.')}: ${i.message}`).join(' | '));
    console.log('RAW INPUT (first 2000 chars):', JSON.stringify(input).slice(0, 2000));
  }
}

main().catch(e => { console.error('FAILED:', e.message ?? e); process.exit(1); });
