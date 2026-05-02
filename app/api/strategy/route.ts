import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient } from '@/lib/ai';
import { buildStrategyPrompt, STRATEGY_SYSTEM_PROMPT, type SchoolResearchContext } from '@/lib/prompts';
import { INITIAL_STRATEGIES } from '@/lib/data';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import type { Student } from '@/types';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { student, forceRegenerate }: { student: Student; forceRegenerate?: boolean } = await req.json();

  if (!student) {
    return NextResponse.json({ error: 'Missing student data' }, { status: 400 });
  }

  if (!forceRegenerate && INITIAL_STRATEGIES[student.id]) {
    return NextResponse.json(INITIAL_STRATEGIES[student.id]);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Research lookup is best-effort
  let researchContext: SchoolResearchContext[] = [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && student.preferred) {
      const preferred = student.preferred.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
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
  const userPrompt = buildStrategyPrompt(student, researchContext);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 6000,
          system: STRATEGY_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        console.error('Strategy stream error:', err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
