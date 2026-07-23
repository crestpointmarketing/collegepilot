import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getAnthropicClient } from '@/lib/ai';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import { SCHOOLS } from '@/lib/schools';
import { getPrompt } from '@/lib/essays/promptLibrary';
import { angleMinerOutputSchema, angleMinerJsonSchema, type AngleMinerOutput } from '@/lib/essays/angleSchema';
import { ANGLE_MINER_SYSTEM_PROMPT, buildAngleMinerPrompt } from '@/lib/essays/anglePrompt';
import { getSchoolFacts } from '@/lib/admissions/schoolFacts';
import type { EssayAngle, EssayProjectRow } from '@/lib/essays/types';
import type { Blueprint } from '@/lib/admissions/blueprint';
import type { Student } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODEL = 'claude-sonnet-5';

const requestSchema = z.object({ projectId: z.string().uuid() });

/** Every profile item name an angle is allowed to cite. */
function allowedEvidenceNames(student: Student): string[] {
  return [
    ...(student.activities ?? []).flatMap(a => [a.position, a.org]),
    ...(student.projects ?? []).map(p => p.name),
    ...(student.awards ?? []).map(w => w.title),
  ].filter(Boolean).map(s => s.toLowerCase());
}

/** True when the cited evidence loosely matches something real in the profile. */
function evidenceExists(cited: string, allowed: string[]): boolean {
  const c = cited.toLowerCase();
  return allowed.some(a => a.includes(c) || c.includes(a));
}

async function mineAngles(client: Anthropic, system: string, prompt: string, allowed: string[]): Promise<AngleMinerOutput> {
  let feedback = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const content = feedback ? `${prompt}\n\nPREVIOUS ATTEMPT REJECTED — fix these issues:\n${feedback}` : prompt;
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 6000,
      system,
      messages: [{ role: 'user', content }],
      tools: [{
        name: 'submit_angles',
        description: 'Submit 3-5 essay angles (directions to test, never prose).',
        input_schema: angleMinerJsonSchema() as Anthropic.Tool['input_schema'],
      }],
      tool_choice: { type: 'tool', name: 'submit_angles' },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'max_tokens') { feedback = 'Output was truncated. Keep each angle substantially shorter.'; continue; }
    const block = message.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') { feedback = 'No tool call was produced.'; continue; }
    // Non-strict tool calls sometimes return arrays as JSON strings, at any
    // depth — normalize before validating.
    const input = block.input as Record<string, unknown>;
    if (typeof input?.angles === 'string') {
      try { input.angles = JSON.parse(input.angles); } catch { /* leave for zod to reject */ }
    }
    if (Array.isArray(input?.angles)) {
      for (const item of input.angles as Array<Record<string, unknown>>) {
        if (!item || typeof item !== 'object') continue;
        for (const key of ['personalEvidence', 'openQuestions']) {
          const v = item[key];
          if (typeof v === 'string') {
            try { item[key] = JSON.parse(v); } catch { item[key] = [v]; }
            if (typeof item[key] === 'string') item[key] = [item[key]];
          }
        }
      }
    }
    const parsed = angleMinerOutputSchema.safeParse(input);
    if (!parsed.success) {
      feedback = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
      continue;
    }
    // Hard rule: every cited evidence item must exist in the profile.
    const ghosts = parsed.data.angles.flatMap(a => a.personalEvidence.filter(e => !evidenceExists(e, allowed)));
    if (ghosts.length) {
      feedback = `These cited evidence items do not exist in the profile — cite only real profile item names: ${[...new Set(ghosts)].join('; ')}`;
      continue;
    }
    return parsed.data;
  }
  throw new Error(`Angle generation failed validation: ${feedback.slice(0, 300)}`);
}

export async function POST(req: NextRequest) {
  try {
    const parsedReq = requestSchema.safeParse(await req.json());
    if (!parsedReq.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { projectId } = parsedReq.data;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const rl = await checkRateLimit(`essay-angles:${user.id}`, 20, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: rateLimitMessage('Angle generation', rl) },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } });
    }
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

    // Project + student + blueprint + sibling context
    const { data: project, error: projErr } = await supabase.from('essay_projects')
      .select('*').eq('id', projectId).eq('user_id', user.id).maybeSingle();
    if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 });
    if (!project) return NextResponse.json({ error: 'Essay project not found' }, { status: 404 });
    const proj = project as EssayProjectRow;

    const { data: studentRow } = await supabase.from('students')
      .select('data').eq('id', proj.student_id).eq('user_id', user.id).maybeSingle();
    if (!studentRow) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    const student = studentRow.data as Student;

    const school = SCHOOLS.find(s => s.id === proj.school_id);
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const libraryPrompt = proj.prompt_id ? getPrompt(proj.prompt_id) : undefined;
    const promptText = libraryPrompt?.promptText ?? proj.custom_prompt?.promptText;
    const wordLimit = libraryPrompt?.wordLimit ?? proj.custom_prompt?.wordLimit;
    if (!promptText) return NextResponse.json({ error: 'This project has no prompt text' }, { status: 400 });

    const { data: bpRow } = await supabase.from('blueprints')
      .select('data').eq('student_id', proj.student_id).eq('user_id', user.id).maybeSingle();
    const blueprint = (bpRow?.data as Blueprint | undefined) ?? null;

    const { data: angleRows } = await supabase.from('essay_angles')
      .select('data, disposition').eq('project_id', projectId).eq('user_id', user.id);
    const existingAngles = (angleRows ?? []).map(r => (r.data as EssayAngle).angle);

    const { data: siblings } = await supabase.from('essay_projects')
      .select('id, selected_angle_id').eq('student_id', proj.student_id).eq('user_id', user.id).neq('id', projectId);
    const siblingIds = (siblings ?? []).map(s => s.selected_angle_id).filter((x): x is string => !!x);
    let siblingTopics: string[] = [];
    if (siblingIds.length) {
      const { data: sibAngles } = await supabase.from('essay_angles').select('data').in('id', siblingIds);
      siblingTopics = (sibAngles ?? []).map(r => (r.data as EssayAngle).angle);
    }

    const client = getAnthropicClient();
    const encoder = new TextEncoder();

    // Stream a heartbeat while the LLM runs — plain JSON responses hit the
    // gateway timeout (504) on long generations. Mirrors /api/strategy.
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(' '));
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(' ')); } catch { /* closed */ }
        }, 5000);
        try {
          const output = await mineAngles(
            client,
            ANGLE_MINER_SYSTEM_PROMPT,
            buildAngleMinerPrompt({ student, school, program: proj.program, promptText, wordLimit, blueprint, existingAngles, siblingEssayTopics: siblingTopics }),
            allowedEvidenceNames(student),
          );

          // Force honesty labels in code, not trust: working_hypothesis always;
          // a school hook is only "verified" when the school has facts on file.
          const hasFacts = !!getSchoolFacts(school.id);
          const angles: EssayAngle[] = output.angles.map(a => ({
            ...a,
            schoolHookStatus: hasFacts ? a.schoolHookStatus : 'unverified',
            status: 'working_hypothesis' as const,
          }));

          const rows = angles.map(a => ({ project_id: projectId, user_id: user.id, data: a, disposition: 'proposed' }));
          const { data: inserted, error: insErr } = await supabase.from('essay_angles').insert(rows).select('*');
          if (insErr) throw new Error(insErr.message);

          if (proj.workflow_status === 'not_started') {
            await supabase.from('essay_projects')
              .update({ workflow_status: 'exploring_angles', updated_at: new Date().toISOString() })
              .eq('id', projectId).eq('user_id', user.id);
          }

          controller.enqueue(encoder.encode(JSON.stringify({ angles: inserted })));
        } catch (err) {
          console.error('essay-angles stream error:', err);
          controller.enqueue(encoder.encode(JSON.stringify({ error: err instanceof Error ? err.message : 'Angle generation failed' })));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (err) {
    console.error('essay-angles error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Angle generation failed' }, { status: 500 });
  }
}
