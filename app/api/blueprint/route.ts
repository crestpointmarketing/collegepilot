import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '@/lib/ai';
import {
  ASSESSMENT_SYSTEM_PROMPT,
  buildAssessmentPrompt,
} from '@/lib/prompts';
import {
  profileAssessmentSubmissionSchema,
  profileAssessmentJsonSchema,
  type ProfileAssessment,
} from '@/lib/admissions/assessment';
import { DATA_CYCLE, ENGINE_VERSION } from '@/lib/admissions/engine';
import { BLUEPRINT_SYSTEM_PROMPT, buildBlueprintSpinePrompt } from '@/lib/blueprintPrompt';
import { blueprintSpineSchema, blueprintSpineJsonSchema, type BlueprintSpineOutput } from '@/lib/admissions/blueprintSchema';
import {
  BLUEPRINT_VERSION,
  collectClaimRegister,
  type Blueprint,
} from '@/lib/admissions/blueprint';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import type { Strategy, Student } from '@/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODEL = 'claude-sonnet-5';

const blueprintRequestSchema = z.object({
  studentId: z.string().trim().min(1).max(120),
});

/**
 * Forced tool call with strict structured outputs. Mirrors the helper in
 * app/api/strategy/route.ts (kept local to avoid coupling the two routes).
 */
async function callStructured<T>(
  client: Anthropic,
  opts: {
    system: string;
    prompt: string;
    toolName: string;
    description: string;
    inputSchema: Record<string, unknown>;
    zodSchema: z.ZodType<T>;
    maxTokens: number;
  },
): Promise<T> {
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: opts.maxTokens,
      system: opts.system,
      betas: ['structured-outputs-2025-11-13'],
      messages: [{ role: 'user', content: feedback ? `${opts.prompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION — fix these issues:\n${feedback}` : opts.prompt }],
      tools: [{
        name: opts.toolName,
        description: opts.description,
        input_schema: opts.inputSchema as Anthropic.Beta.BetaTool['input_schema'],
        strict: true,
      }],
      tool_choice: { type: 'tool', name: opts.toolName },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'max_tokens') {
      feedback = 'Output was truncated (max_tokens). Be substantially more concise in every field.';
      continue;
    }
    const block = message.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      feedback = 'No tool call was produced.';
      continue;
    }
    const parsed = opts.zodSchema.safeParse(block.input);
    if (parsed.success) return parsed.data;
    feedback = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
  }
  throw new Error(`Structured ${opts.toolName} output failed validation after retry: ${feedback.slice(0, 300)}`);
}

/** Assemble a Blueprint from the generated spine, stubbing volumes filled later. */
function assembleBlueprint(student: Student, spine: BlueprintSpineOutput): Blueprint {
  const base: Omit<Blueprint, 'claimRegister'> = {
    version: BLUEPRINT_VERSION,
    generatedAt: new Date().toISOString(),
    studentId: student.id,
    studentName: student.name,
    status: 'working_draft',
    draftLabel: 'v0.1',
    thesis: spine.thesis,
    executiveOverview: spine.executiveOverview,
    identity: spine.identity,
    positioning: spine.positioning,
    futureSelf: spine.futureSelf,
    // Volumes II / V / VI are generated in later phases; empty-but-valid stubs.
    evidence: { academicFoundation: [], threePillars: [], caseStudies: [], rangeEvidence: [] },
    programFit: { needs: [], landscape: [], fitMatrix: [], priorityPrograms: [], roundStrategy: [], bindingPrinciple: '' },
    narrative: { masterLine: '', schoolEmphasis: [], commonAppDirections: [], activitiesArchitecture: [], resumeHeadline: '', recommendations: [], interviewStoryBank: [] },
    familyReviewQuestions: spine.familyReviewQuestions,
    next30Days: spine.next30Days,
    dataCycle: DATA_CYCLE,
    engineVersion: ENGINE_VERSION,
  };
  return { ...base, claimRegister: collectClaimRegister(base) };
}

export async function POST(req: NextRequest) {
  try {
    const parsedRequest = blueprintRequestSchema.safeParse(await req.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Invalid blueprint request' }, { status: 400 });
    }
    const { studentId } = parsedRequest.data;

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
    const student = studentRow.data as Student;

    // Reuse the assessment from an existing strategy when available — the
    // Blueprint builds on the same ten-dimension read, no duplicate grading.
    const { data: strategyRow } = await supabase
      .from('strategies')
      .select('data')
      .eq('student_id', studentId)
      .eq('user_id', user.id)
      .maybeSingle();
    const storedAssessment = (strategyRow?.data as Strategy | undefined)?.v2?.assessment;

    const rl = checkRateLimit(`blueprint:${user.id}`, 8, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: rateLimitMessage('Blueprint generation', rl) },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const client = getAnthropicClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(' '));
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(' ')); } catch { /* stream closed */ }
        }, 5000);
        try {
          // Reuse or compute the ten-dimension assessment.
          const assessment: ProfileAssessment = storedAssessment ?? await callStructured(client, {
            system: ASSESSMENT_SYSTEM_PROMPT,
            prompt: buildAssessmentPrompt(student),
            toolName: 'submit_assessment',
            description: 'Submit the structured ten-dimension profile assessment.',
            inputSchema: profileAssessmentJsonSchema(),
            zodSchema: profileAssessmentSubmissionSchema,
            maxTokens: 12000,
          });

          // Generate the identity spine (Volumes I / III / IV + overview).
          const spine = await callStructured(client, {
            system: BLUEPRINT_SYSTEM_PROMPT,
            prompt: buildBlueprintSpinePrompt(student, assessment),
            toolName: 'submit_blueprint_spine',
            description: 'Submit the Blueprint identity spine: overview, identity, positioning, future self, family questions, 30-day plan.',
            inputSchema: blueprintSpineJsonSchema(),
            zodSchema: blueprintSpineSchema,
            maxTokens: 16000,
          });

          const blueprint = assembleBlueprint(student, spine);

          const { error: saveError } = await supabase.from('blueprints')
            .upsert({ student_id: studentId, user_id: user.id, data: blueprint }, { onConflict: 'student_id,user_id' });
          if (saveError) console.error('Server-side blueprint save failed:', saveError);

          controller.enqueue(encoder.encode(JSON.stringify(blueprint)));
        } catch (err) {
          console.error('Blueprint generation error:', err);
          controller.enqueue(encoder.encode(JSON.stringify({
            error: err instanceof Error ? err.message : 'Blueprint generation failed',
          })));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    console.error('Blueprint route error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Blueprint generation failed' },
      { status: 500 },
    );
  }
}
