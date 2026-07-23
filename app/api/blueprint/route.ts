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
import { BLUEPRINT_VOLUMES_SYSTEM_PROMPT, buildBlueprintVolumesPrompt } from '@/lib/blueprintPrompt';
import { blueprintSpineSchema, blueprintSpineJsonSchema, type BlueprintSpineOutput } from '@/lib/admissions/blueprintSchema';
import { blueprintVolumesSchema, blueprintVolumesJsonSchema, type BlueprintVolumesOutput } from '@/lib/admissions/blueprintVolumesSchema';
import {
  BLUEPRINT_VERSION,
  collectClaimRegister,
  type Blueprint,
  type BlueprintRevision,
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
 * Forced tool call with schema validation + one retry.
 *
 * `strict: true` (default) uses constrained decoding for guaranteed schema
 * conformance — but the compiled grammar has a size limit. Large schemas (the
 * Blueprint spine) must pass `strict: false`: a normal forced tool call, no
 * grammar compilation, with the zod safeParse + retry loop catching any
 * deviation. Mirrors the helper in app/api/strategy/route.ts.
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
    strict?: boolean;
  },
): Promise<T> {
  const strict = opts.strict ?? true;
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = feedback ? `${opts.prompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION — fix these issues:\n${feedback}` : opts.prompt;
    const stream = strict
      ? client.beta.messages.stream({
          model: MODEL,
          max_tokens: opts.maxTokens,
          system: opts.system,
          betas: ['structured-outputs-2025-11-13'],
          messages: [{ role: 'user', content }],
          tools: [{
            name: opts.toolName,
            description: opts.description,
            input_schema: opts.inputSchema as Anthropic.Beta.BetaTool['input_schema'],
            strict: true,
          }],
          tool_choice: { type: 'tool', name: opts.toolName },
        })
      : client.messages.stream({
          model: MODEL,
          max_tokens: opts.maxTokens,
          system: opts.system,
          messages: [{ role: 'user', content }],
          tools: [{
            name: opts.toolName,
            description: opts.description,
            input_schema: opts.inputSchema as Anthropic.Tool['input_schema'],
          }],
          tool_choice: { type: 'tool', name: opts.toolName },
        });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'max_tokens') {
      feedback = 'Output was truncated (max_tokens). Be substantially more concise in every field.';
      continue;
    }
    // Both the beta and non-beta message shapes expose content blocks with a
    // `type` discriminator and (for tool_use) an `input`; normalize the union.
    const blocks = message.content as Array<{ type: string; input?: unknown }>;
    const block = blocks.find(b => b.type === 'tool_use');
    if (!block) {
      feedback = 'No tool call was produced.';
      continue;
    }
    const parsed = opts.zodSchema.safeParse(block.input);
    if (parsed.success) return parsed.data;
    feedback = parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
  }
  throw new Error(`Structured ${opts.toolName} output failed validation after retry: ${feedback.slice(0, 300)}`);
}

const EMPTY_EVIDENCE: Blueprint['evidence'] = { academicFoundation: [], threePillars: [], caseStudies: [], rangeEvidence: [] };
const EMPTY_PROGRAM_FIT: Blueprint['programFit'] = { needs: [], landscape: [], fitMatrix: [], priorityPrograms: [], roundStrategy: [], bindingPrinciple: '' };
const EMPTY_NARRATIVE: Blueprint['narrative'] = { masterLine: '', schoolEmphasis: [], commonAppDirections: [], activitiesArchitecture: [], resumeHeadline: '', recommendations: [], interviewStoryBank: [] };

/** "v0.1" → "v0.2". A working draft evolves; the label is a minor bump each regenerate. */
function nextDraftLabel(prev: string | undefined): string {
  const m = /^v0\.(\d+)$/.exec(prev ?? '');
  return m ? `v0.${parseInt(m[1], 10) + 1}` : 'v0.1';
}

/**
 * Assemble a Blueprint from the generated spine + volumes (II/V/VI). When the
 * volumes call failed, `volumes` is null and the empty-but-valid stubs are used
 * so the Blueprint still saves. Versioning: the draft label bumps each
 * regenerate and the prior draft is pushed onto the revision history.
 */
function assembleBlueprint(
  student: Student,
  spine: BlueprintSpineOutput,
  volumes: BlueprintVolumesOutput | null,
  prior: Blueprint | null,
  now: string,
): Blueprint {
  const draftLabel = nextDraftLabel(prior?.draftLabel);
  const revisions: BlueprintRevision[] = prior
    ? [...(prior.revisions ?? []), { draftLabel: prior.draftLabel, generatedAt: prior.generatedAt, thesis: prior.thesis }]
    : [];

  const base: Omit<Blueprint, 'claimRegister'> = {
    version: BLUEPRINT_VERSION,
    generatedAt: now,
    studentId: student.id,
    studentName: student.name,
    status: 'working_draft',
    draftLabel,
    revisions,
    thesis: spine.thesis,
    executiveOverview: spine.executiveOverview,
    identity: spine.identity,
    positioning: spine.positioning,
    futureSelf: spine.futureSelf,
    evidence: volumes?.evidence ?? EMPTY_EVIDENCE,
    programFit: volumes?.programFit ?? EMPTY_PROGRAM_FIT,
    narrative: volumes?.narrative ?? EMPTY_NARRATIVE,
    familyReviewQuestions: spine.familyReviewQuestions,
    next30Days: spine.next30Days,
    dataCycle: DATA_CYCLE,
    engineVersion: ENGINE_VERSION,
  };
  return { ...base, claimRegister: collectClaimRegister(base) };
}

/** Compact identity-spine summary fed to the volumes call so they cohere. */
function summarizeSpine(spine: BlueprintSpineOutput): string {
  return [
    `THESIS: ${spine.thesis}`,
    `CORE IDENTITY: ${spine.identity.coreIdentity}`,
    `DISTINCTIVE CAPABILITY: ${spine.identity.distinctiveCapability}`,
    `POSITIONING STATEMENT: ${spine.identity.positioningStatement.text}`,
    `POSITIONING DECISION: ${spine.positioning.positioningDecision}`,
    `ARCHETYPE: ${spine.positioning.archetypeLabel}`,
    `FUTURE IDENTITY: ${spine.futureSelf.futureIdentity}`,
    `BEST-FIT ACADEMIC MODEL: ${spine.executiveOverview.bestFitModel}`,
  ].join('\n');
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
      console.error('blueprint: student load failed:', studentError);
      return NextResponse.json({ error: 'Could not load the student.' }, { status: 500 });
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

    // Prior blueprint (if any) drives version history — each regenerate bumps
    // the draft label and pushes the previous draft onto the revision list.
    const { data: priorRow } = await supabase
      .from('blueprints')
      .select('data')
      .eq('student_id', studentId)
      .eq('user_id', user.id)
      .maybeSingle();
    const priorBlueprint = (priorRow?.data as Blueprint | undefined) ?? null;

    const rl = await checkRateLimit(`blueprint:${user.id}`, 8, 60 * 60 * 1000);
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

          // If the student confirmed a positioning (Stage 1), anchor the
          // Blueprint's identity to it instead of letting the model re-decide.
          const pos = student.positioning;
          const confirmedIdentity = pos && pos.confirmed.length
            ? pos.confirmed
                .slice()
                .sort((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0))
                .map(c => {
                  const h = pos.hypotheses.find(x => x.id === c.hypothesisId);
                  if (!h) return '';
                  return `- ${c.role.toUpperCase()}: ${h.label}${h.supportingEvidence.length ? ` (evidence: ${h.supportingEvidence.slice(0, 3).join('; ')})` : ''}`;
                })
                .filter(Boolean)
                .join('\n')
            : undefined;

          // Generate the identity spine (Volumes I / III / IV + overview).
          const spine = await callStructured(client, {
            system: BLUEPRINT_SYSTEM_PROMPT,
            prompt: buildBlueprintSpinePrompt(student, assessment, confirmedIdentity),
            toolName: 'submit_blueprint_spine',
            description: 'Submit the Blueprint identity spine: overview, identity, positioning, future self, family questions, 30-day plan.',
            inputSchema: blueprintSpineJsonSchema(),
            zodSchema: blueprintSpineSchema,
            maxTokens: 16000,
            // Non-strict: the spine schema is too large for the strict grammar
            // compiler. zod safeParse + retry enforces conformance instead.
            strict: false,
          });

          // Volumes II / V / VI — a second call built around the spine. Any
          // failure here is non-fatal: the Blueprint still saves with the spine
          // and empty-but-valid volume stubs (never blocks the whole doc).
          let volumes: BlueprintVolumesOutput | null = null;
          try {
            volumes = await callStructured(client, {
              system: BLUEPRINT_VOLUMES_SYSTEM_PROMPT,
              prompt: buildBlueprintVolumesPrompt(student, assessment, summarizeSpine(spine)),
              toolName: 'submit_blueprint_volumes',
              description: 'Submit Blueprint Volumes II (Evidence), V (Program Fit), and VI (Narrative System).',
              inputSchema: blueprintVolumesJsonSchema(),
              zodSchema: blueprintVolumesSchema,
              maxTokens: 20000,
              strict: false,
            });
          } catch (volErr) {
            console.error('Blueprint volumes generation failed (spine kept):', volErr);
          }

          const blueprint = assembleBlueprint(student, spine, volumes, priorBlueprint, new Date().toISOString());

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
