import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '@/lib/ai';
import { ASSESSMENT_SYSTEM_PROMPT, buildAssessmentPrompt } from '@/lib/prompts';
import {
  profileAssessmentSubmissionSchema, profileAssessmentJsonSchema, type ProfileAssessment,
} from '@/lib/admissions/assessment';
import { DIRECTION_SYSTEM_PROMPT, buildDirectionPrompt } from '@/lib/blueprintPrompt';
import { directionOutputSchema, directionJsonSchema } from '@/lib/admissions/directionSchema';
import type { AcademicDirection, DirectionState } from '@/lib/admissions/journey';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import type { Strategy, Student } from '@/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODEL = 'claude-sonnet-5';
const requestSchema = z.object({ studentId: z.string().trim().min(1).max(120) });

async function callStructured<T>(
  client: Anthropic,
  opts: { system: string; prompt: string; toolName: string; description: string; inputSchema: Record<string, unknown>; zodSchema: z.ZodType<T>; maxTokens: number; strict?: boolean },
): Promise<T> {
  const strict = opts.strict ?? true;
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = feedback ? `${opts.prompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION — fix these issues:\n${feedback}` : opts.prompt;
    const stream = strict
      ? client.beta.messages.stream({
          model: MODEL, max_tokens: opts.maxTokens, system: opts.system, betas: ['structured-outputs-2025-11-13'],
          messages: [{ role: 'user', content }],
          tools: [{ name: opts.toolName, description: opts.description, input_schema: opts.inputSchema as Anthropic.Beta.BetaTool['input_schema'], strict: true }],
          tool_choice: { type: 'tool', name: opts.toolName },
        })
      : client.messages.stream({
          model: MODEL, max_tokens: opts.maxTokens, system: opts.system,
          messages: [{ role: 'user', content }],
          tools: [{ name: opts.toolName, description: opts.description, input_schema: opts.inputSchema as Anthropic.Tool['input_schema'] }],
          tool_choice: { type: 'tool', name: opts.toolName },
        });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'max_tokens') { feedback = 'Output truncated (max_tokens). Be more concise.'; continue; }
    const blocks = message.content as Array<{ type: string; input?: unknown }>;
    const block = blocks.find(b => b.type === 'tool_use');
    if (!block) { feedback = 'No tool call was produced.'; continue; }
    const parsed = opts.zodSchema.safeParse(block.input);
    if (parsed.success) return parsed.data;
    feedback = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
  }
  throw new Error(`Structured ${opts.toolName} output failed validation after retry: ${feedback.slice(0, 300)}`);
}

export async function POST(req: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid direction request' }, { status: 400 });
    const { studentId } = parsed.data;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: studentRow, error: studentError } = await supabase
      .from('students').select('data').eq('id', studentId).eq('user_id', user.id).maybeSingle();
    if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });
    if (!studentRow) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    const student = studentRow.data as Student;

    // Direction requires a confirmed identity (Stage 1).
    const pos = student.positioning;
    if (!pos || !pos.confirmed.length) {
      return NextResponse.json({ error: 'Confirm an identity on the Blueprint page first.' }, { status: 409 });
    }
    const confirmedIdentity = pos.confirmed
      .slice().sort((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0))
      .map(c => {
        const h = pos.hypotheses.find(x => x.id === c.hypothesisId);
        return h ? `- ${c.role.toUpperCase()}: ${h.label}${h.fieldTypes.length ? ` (fields: ${h.fieldTypes.join(', ')})` : ''}` : '';
      }).filter(Boolean).join('\n');

    const { data: strategyRow } = await supabase
      .from('strategies').select('data').eq('student_id', studentId).eq('user_id', user.id).maybeSingle();
    const storedAssessment = (strategyRow?.data as Strategy | undefined)?.v2?.assessment;

    const rl = checkRateLimit(`direction:${user.id}`, 12, 60 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: rateLimitMessage('Direction', rl) }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

    const client = getAnthropicClient();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(' '));
        const heartbeat = setInterval(() => { try { controller.enqueue(encoder.encode(' ')); } catch { /* closed */ } }, 5000);
        try {
          const assessment: ProfileAssessment = storedAssessment ?? await callStructured(client, {
            system: ASSESSMENT_SYSTEM_PROMPT, prompt: buildAssessmentPrompt(student),
            toolName: 'submit_assessment', description: 'Submit the structured ten-dimension profile assessment.',
            inputSchema: profileAssessmentJsonSchema(), zodSchema: profileAssessmentSubmissionSchema, maxTokens: 12000,
          });

          const out = await callStructured(client, {
            system: DIRECTION_SYSTEM_PROMPT, prompt: buildDirectionPrompt(student, assessment, confirmedIdentity),
            toolName: 'submit_directions', description: 'Submit 3–5 academic directions (major/program types, no schools).',
            inputSchema: directionJsonSchema(), zodSchema: directionOutputSchema, maxTokens: 9000, strict: false,
          });

          const directions: AcademicDirection[] = out.directions.map((d, i) => ({ ...d, id: `dir${i + 1}` }));
          const state: Pick<DirectionState, 'generatedAt' | 'directions'> = { generatedAt: new Date().toISOString(), directions };
          controller.enqueue(encoder.encode(JSON.stringify(state)));
        } catch (err) {
          console.error('Direction generation error:', err);
          controller.enqueue(encoder.encode(JSON.stringify({ error: err instanceof Error ? err.message : 'Direction generation failed' })));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (err) {
    console.error('Direction route error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Direction generation failed' }, { status: 500 });
  }
}
