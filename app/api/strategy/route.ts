import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient } from '@/lib/ai';
import { buildStrategyPrompt, STRATEGY_SYSTEM_PROMPT, type SchoolResearchContext } from '@/lib/prompts';
import { INITIAL_STRATEGIES, SAMPLE_STUDENTS } from '@/lib/data';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import type { Student } from '@/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;

const strategyRequestSchema = z.object({
  studentId: z.string().trim().min(1).max(120),
  forceRegenerate: z.boolean().optional().default(false),
});

function isUnmodifiedSampleStudent(student: Student) {
  const sample = SAMPLE_STUDENTS.find(s => s.id === student.id);
  if (!sample) return false;
  return JSON.stringify(student) === JSON.stringify(sample);
}

export async function POST(req: NextRequest) {
  try {
  const parsedRequest = strategyRequestSchema.safeParse(await req.json());
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Invalid student request' }, { status: 400 });
  }
  const { studentId, forceRegenerate } = parsedRequest.data;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: studentRow, error: studentError } = await supabase
    .from('students')
    .select('data')
    .eq('id', studentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!studentRow) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  const storedStudent = studentRow.data as Student;

  if (!forceRegenerate && isUnmodifiedSampleStudent(storedStudent) && INITIAL_STRATEGIES[storedStudent.id]) {
    return NextResponse.json(INITIAL_STRATEGIES[storedStudent.id]);
  }

  // Most expensive route in the app (16k tokens + adaptive thinking) — cap per user
  const rl = checkRateLimit(`strategy:${user.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rateLimitMessage('Strategy generation', rl) },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Research lookup is best-effort
  let researchContext: SchoolResearchContext[] = [];
  try {
    if (storedStudent.preferred) {
      const preferred = storedStudent.preferred.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const { data: rows } = await supabase
        .from('school_research').select('school_name, program, data').eq('user_id', user.id);
      if (rows) {
        researchContext = rows
          .filter(r => preferred.some(p => r.school_name.toLowerCase().includes(p) || p.includes(r.school_name.toLowerCase())))
          .map(r => ({
            school_name: r.school_name,
            program: r.program,
            admission_requirements: r.data?.admission_requirements ?? '',
            program_details: r.data?.program_details ?? '',
            career_outcomes: r.data?.career_outcomes ?? '',
            community_insights: r.data?.community_insights ?? '',
            application_tips: r.data?.application_tips ?? [],
            official_vs_community: r.data?.official_vs_community ?? '',
          }));
      }
    }
  } catch { /* best-effort */ }

  const client = getAnthropicClient();
  const userPrompt = buildStrategyPrompt(storedStudent, researchContext);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 16000,
          thinking: { type: 'adaptive' },
          system: STRATEGY_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        for await (const event of anthropicStream) {
          // Only forward text tokens — skip thinking blocks
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        console.error('Strategy stream error:', err);
        controller.enqueue(encoder.encode(JSON.stringify({
          error: err instanceof Error ? err.message : 'Strategy generation failed',
        })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
  } catch (err) {
    console.error('Strategy route error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Strategy generation failed' },
      { status: 500 },
    );
  }
}
