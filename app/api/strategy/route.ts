import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient } from '@/lib/ai';
import { buildStrategyPrompt, STRATEGY_SYSTEM_PROMPT, type SchoolResearchContext } from '@/lib/prompts';
import { INITIAL_STRATEGIES } from '@/lib/data';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import type { Student, Strategy } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { student, forceRegenerate }: { student: Student; forceRegenerate?: boolean } = await req.json();

    if (!student) {
      return NextResponse.json({ error: 'Missing student data' }, { status: 400 });
    }

    // Return canned strategy for sample students unless user explicitly regenerates
    if (!forceRegenerate && INITIAL_STRATEGIES[student.id]) {
      return NextResponse.json(INITIAL_STRATEGIES[student.id]);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    // Look up saved research for the student's preferred schools
    let researchContext: SchoolResearchContext[] = [];
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user && student.preferred) {
        const preferredSchools = student.preferred
          .split(/[,;]/)
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);

        const { data: researchRows } = await supabase
          .from('school_research')
          .select('school_name, program, data')
          .eq('user_id', user.id);

        if (researchRows) {
          researchContext = researchRows
            .filter(row =>
              preferredSchools.some(pref =>
                row.school_name.toLowerCase().includes(pref) ||
                pref.includes(row.school_name.toLowerCase())
              )
            )
            .map(row => ({
              school_name: row.school_name,
              program: row.program,
              admission_requirements: row.data?.admission_requirements ?? '',
              program_details: row.data?.program_details ?? '',
              career_outcomes: row.data?.career_outcomes ?? '',
              community_insights: row.data?.community_insights ?? '',
              application_tips: row.data?.application_tips ?? [],
              official_vs_community: row.data?.official_vs_community ?? '',
            }));
        }
      }
    } catch {
      // Research lookup is best-effort — don't fail strategy generation
    }

    const client = getAnthropicClient();
    const userPrompt = buildStrategyPrompt(student, researchContext);

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: STRATEGY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content
      .filter(block => block.type === 'text')
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in model response');
    const strategy: Strategy = JSON.parse(jsonMatch[0]);

    return NextResponse.json(strategy);
  } catch (error) {
    console.error('Strategy generation error:', error);
    const fallback = Object.values(INITIAL_STRATEGIES)[0];
    if (fallback) return NextResponse.json(fallback);
    return NextResponse.json({ error: 'Strategy generation failed' }, { status: 500 });
  }
}
