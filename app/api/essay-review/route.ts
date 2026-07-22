import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getAnthropicClient } from '@/lib/ai';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import { SCHOOLS } from '@/lib/schools';
import { getPrompt } from '@/lib/essays/promptLibrary';
import { essayReviewSchema, essayReviewJsonSchema, type EssayReview } from '@/lib/essays/reviewSchema';
import { ESSAY_REVIEW_SYSTEM_PROMPT, buildEssayReviewPrompt } from '@/lib/essays/reviewPrompt';
import type { EssayAngle, EssayProjectRow } from '@/lib/essays/types';
import type { Student } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL = 'claude-sonnet-5';
const requestSchema = z.object({ revisionId: z.string().uuid() });

/** Whitespace-insensitive verbatim check: quote must appear in the essay. */
function quoteInEssay(quote: string, essay: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s ]+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
  return norm(essay).includes(norm(quote));
}

async function runReview(client: Anthropic, prompt: string, essayText: string): Promise<EssayReview> {
  let feedback = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const content = feedback ? `${prompt}\n\nPREVIOUS ATTEMPT REJECTED — fix these issues:\n${feedback}` : prompt;
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: ESSAY_REVIEW_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      tools: [{
        name: 'submit_review',
        description: 'Submit the structured essay review (quotes verbatim, questions only, no replacement prose).',
        input_schema: essayReviewJsonSchema() as Anthropic.Tool['input_schema'],
      }],
      tool_choice: { type: 'tool', name: 'submit_review' },
    });
    const message = await stream.finalMessage();
    const block = message.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') { feedback = 'No tool call was produced.'; continue; }
    // Non-strict tool calls sometimes return arrays as JSON strings — unwrap.
    const input = block.input as Record<string, unknown>;
    for (const key of ['rubric', 'claims', 'revisionPriorities', 'nextDraftQuestions']) {
      if (typeof input?.[key] === 'string') { try { input[key] = JSON.parse(input[key] as string); } catch { /* zod rejects */ } }
    }
    const parsed = essayReviewSchema.safeParse(input);
    if (!parsed.success) {
      feedback = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
      continue;
    }
    // Hard rule: every quote must literally appear in the draft.
    const ghosts = [
      ...parsed.data.rubric.filter(r => !quoteInEssay(r.quote, essayText)).map(r => r.quote),
      ...parsed.data.claims.filter(c => !quoteInEssay(c.quote, essayText)).map(c => c.quote),
    ];
    if (ghosts.length) {
      feedback = `These quotes are not verbatim from the draft — copy exact sentences: ${ghosts.slice(0, 3).map(g => `"${g.slice(0, 80)}"`).join('; ')}`;
      continue;
    }
    return parsed.data;
  }
  throw new Error(`Review failed validation: ${feedback.slice(0, 300)}`);
}

export async function POST(req: NextRequest) {
  try {
    const parsedReq = requestSchema.safeParse(await req.json());
    if (!parsedReq.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { revisionId } = parsedReq.data;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const rl = checkRateLimit(`essay-review:${user.id}`, 15, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: rateLimitMessage('Essay review', rl) },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } });
    }
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

    const { data: rev } = await supabase.from('essay_revisions')
      .select('*').eq('id', revisionId).eq('user_id', user.id).maybeSingle();
    if (!rev) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });

    const { data: projRow } = await supabase.from('essay_projects')
      .select('*').eq('id', rev.project_id).eq('user_id', user.id).maybeSingle();
    if (!projRow) return NextResponse.json({ error: 'Essay project not found' }, { status: 404 });
    const proj = projRow as EssayProjectRow;

    const { data: studentRow } = await supabase.from('students')
      .select('data').eq('id', proj.student_id).eq('user_id', user.id).maybeSingle();
    if (!studentRow) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    const student = studentRow.data as Student;

    const school = SCHOOLS.find(s => s.id === proj.school_id);
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const lib = proj.prompt_id ? getPrompt(proj.prompt_id) : undefined;
    const promptText = lib?.promptText ?? proj.custom_prompt?.promptText;
    if (!promptText) return NextResponse.json({ error: 'This project has no prompt text' }, { status: 400 });

    let selectedAngle: EssayAngle | null = null;
    if (proj.selected_angle_id) {
      const { data: ang } = await supabase.from('essay_angles')
        .select('data').eq('id', proj.selected_angle_id).maybeSingle();
      selectedAngle = (ang?.data as EssayAngle | undefined) ?? null;
    }

    const client = getAnthropicClient();
    const review = await runReview(client, buildEssayReviewPrompt({
      student, school, promptText,
      wordLimit: lib?.wordLimit ?? proj.custom_prompt?.wordLimit,
      essayText: rev.content as string,
      selectedAngle,
    }), rev.content as string);

    const { data: saved, error: insErr } = await supabase.from('essay_reviews')
      .insert({ revision_id: revisionId, user_id: user.id, data: review, model_version: MODEL })
      .select('*').single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    await supabase.from('essay_projects')
      .update({ workflow_status: 'needs_revision', updated_at: new Date().toISOString() })
      .eq('id', proj.id).eq('user_id', user.id);

    return NextResponse.json({ review: saved });
  } catch (err) {
    console.error('essay-review error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Essay review failed' }, { status: 500 });
  }
}
