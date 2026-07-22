/**
 * LIVE reproduction of the Angle Miner (E3 debugging). Gated behind RUN_LIVE=1.
 *   RUN_LIVE=1 npx vitest run lib/essays/verifyAnglesLive.test.ts
 * Replicates the exact route call + validation and prints what actually happens.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { SAMPLE_STUDENTS } from '../data';
import { SCHOOLS } from '../schools';
import { promptsForSchool } from './promptLibrary';
import { angleMinerOutputSchema, angleMinerJsonSchema } from './angleSchema';
import { ANGLE_MINER_SYSTEM_PROMPT, buildAngleMinerPrompt } from './anglePrompt';
import { getAnthropicClient } from '../ai';

try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env.local */ }

const LIVE = process.env.RUN_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;

describe.runIf(LIVE)('Angle Miner live repro', () => {
  it('mines angles for NYU without error', async () => {
    const client = getAnthropicClient();
    const student = SAMPLE_STUDENTS[0];
    const school = SCHOOLS.find(s => s.id === 'nyu')!;
    const prompt = promptsForSchool('nyu')[0];
    const built = buildAngleMinerPrompt({
      student, school, program: null, promptText: prompt.promptText, wordLimit: prompt.wordLimit,
      blueprint: null, existingAngles: [], siblingEssayTopics: [],
    });

    const t0 = Date.now();
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 9000,
      system: ANGLE_MINER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: built }],
      tools: [{ name: 'submit_angles', description: 'Submit 3-5 essay angles.', input_schema: angleMinerJsonSchema() as Anthropic.Tool['input_schema'] }],
      tool_choice: { type: 'tool', name: 'submit_angles' },
    });
    const message = await stream.finalMessage();
    console.log(`\n[timing] ${Math.round((Date.now() - t0) / 1000)}s · stop_reason=${message.stop_reason}`);

    const block = message.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') { console.log('NO TOOL CALL. content types:', message.content.map(b => b.type)); throw new Error('no tool call'); }
    const input = block.input as Record<string, unknown>;
    console.log('[raw keys]', Object.keys(input), '· angles typeof=', typeof input.angles, Array.isArray(input.angles) ? `len ${(input.angles as unknown[]).length}` : '');

    const parsed = angleMinerOutputSchema.safeParse(input);
    if (!parsed.success) {
      console.log('[zod issues]', JSON.stringify(parsed.error.issues.slice(0, 8), null, 2));
      console.log('[raw sample]', JSON.stringify(input).slice(0, 800));
    } else {
      console.log('[OK] angles:', parsed.data.angles.map(a => a.angle));
      console.log('[evidence]', parsed.data.angles.map(a => a.personalEvidence));
    }
    expect(parsed.success).toBe(true);
  }, 240000);
});
