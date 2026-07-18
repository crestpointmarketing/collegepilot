import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '@/lib/ai';
import {
  ASSESSMENT_SYSTEM_PROMPT,
  NARRATIVE_SYSTEM_PROMPT,
  buildAssessmentPrompt,
  buildNarrativePrompt,
  type SchoolResearchContext,
} from '@/lib/prompts';
import {
  profileAssessmentSubmissionSchema,
  profileAssessmentJsonSchema,
  narrativeOutputSchema,
  narrativeOutputJsonSchema,
  type NarrativeOutput,
  type ProfileAssessment,
} from '@/lib/admissions/assessment';
import { DATA_CYCLE, ENGINE_VERSION, runEngine, type SchoolEvaluation } from '@/lib/admissions/engine';
import { INITIAL_STRATEGIES, SAMPLE_STUDENTS } from '@/lib/data';
import { SCHOOLS } from '@/lib/schools';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import { stableEquals } from '@/lib/stableStringify';
import type { Strategy, Student } from '@/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODEL = 'claude-sonnet-5';

const strategyRequestSchema = z.object({
  studentId: z.string().trim().min(1).max(120),
  forceRegenerate: z.boolean().optional().default(false),
});

function isUnmodifiedSampleStudent(student: Student) {
  const sample = SAMPLE_STUDENTS.find(s => s.id === student.id);
  if (!sample) return false;
  // jsonb-loaded rows lose key order — plain JSON.stringify equality would
  // always fail and silently bypass the pre-baked-strategy cost control.
  return stableEquals(student, sample);
}

/**
 * Forced tool call with strict structured outputs (constrained decoding
 * guarantees schema conformance). One retry on residual validation failure
 * with the validation errors fed back to the model.
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

/* ── Assemble the UI-facing Strategy from computed + narrative parts ── */

function fallbackNote(ev: SchoolEvaluation): string {
  const drivers = ev.trace.filter(t => t.stepDelta !== 0).map(t => t.label).slice(0, 3);
  return drivers.length ? `${ev.tierLabel}. ${drivers.join('; ')}.` : `${ev.tierLabel} based on the published admit rate.`;
}

function assembleStrategy(
  assessment: ProfileAssessment,
  engine: ReturnType<typeof runEngine>,
  narrative: NarrativeOutput,
): Strategy {
  // Normalize dashes/spacing so "UW–Madison" matches "UW-Madison" etc.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const noteFor = (ev: SchoolEvaluation) =>
    narrative.school_notes.find(n => norm(n.school) === norm(ev.short))?.note ?? fallbackNote(ev);

  const entry = (ev: SchoolEvaluation) => ({
    name: ev.short,
    chance: `${ev.band.min}–${ev.band.max}%`,
    note: noteFor(ev),
  });

  const { portfolio, selected } = engine;
  const shutoutNote = portfolio.warnings.includes('no_admission_safety')
    ? ' ⚠ This list has no true admission safety — shutout risk is elevated.'
    : '';

  return {
    analysis: narrative.analysis,
    positioning: narrative.positioning,
    competitiveness: {
      top10: { level: portfolio.competitivenessLevels.top10, note: narrative.competitiveness_notes.top10 },
      top20: { level: portfolio.competitivenessLevels.top20, note: narrative.competitiveness_notes.top20 },
      top50: { level: portfolio.competitivenessLevels.top50, note: narrative.competitiveness_notes.top50 },
      bullets: narrative.competitiveness_notes.bullets,
    },
    schools: {
      reach: selected.filter(e => e.uiBucket === 'reach').map(entry),
      match: selected.filter(e => e.uiBucket === 'match').map(entry),
      safety: selected.filter(e => e.uiBucket === 'safety').map(entry),
    },
    strategy: { ed_ea: narrative.ed_ea_strategy, narrative: narrative.narrative_direction },
    plan: narrative.plan,
    meta: {
      overall_success_probability: `${portfolio.pAtLeastOne.lowerPct}–${portfolio.pAtLeastOne.upperPct}%`,
      assessment: `${narrative.meta_assessment}${shutoutNote}`,
      improvement_levers: narrative.levers.map(l => `${l.action} → ${l.expected_effect} (by ${l.deadline})`),
    },
    v2: {
      version: 2,
      generatedAt: new Date().toISOString(),
      dataCycle: DATA_CYCLE,
      engineVersion: ENGINE_VERSION,
      assessment,
      evaluations: selected,
      suggestions: engine.suggestions,
      portfolio,
      levers: narrative.levers,
    },
  };
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

    // Two LLM calls per generation — cap per user
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

    // Research lookup is best-effort and only consumed by step 3 — fire it
    // now and await it right before the narrative call so it overlaps with
    // the assessment LLM call instead of delaying it.
    const researchPromise: Promise<SchoolResearchContext[]> = (async () => {
      try {
        if (!storedStudent.preferred) return [];
        const preferred = storedStudent.preferred.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const { data: rows } = await supabase
          .from('school_research').select('school_name, program, data').eq('user_id', user.id);
        return (rows ?? [])
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
      } catch { return []; /* best-effort */ }
    })();

    const client = getAnthropicClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // First byte immediately (gateways with short TTFB timeouts), then a
        // heartbeat through both LLM calls. Leading whitespace is ignored by
        // the client's JSON extraction.
        controller.enqueue(encoder.encode(' '));
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(' ')); } catch { /* stream closed */ }
        }, 5000);
        try {
          // Step 1 — LLM grades the profile (no probabilities allowed).
          const assessment = await callStructured(client, {
            system: ASSESSMENT_SYSTEM_PROMPT,
            prompt: buildAssessmentPrompt(storedStudent),
            toolName: 'submit_assessment',
            description: 'Submit the structured ten-dimension profile assessment.',
            inputSchema: profileAssessmentJsonSchema(),
            zodSchema: profileAssessmentSubmissionSchema,
            maxTokens: 12000,
          });

          // Step 2 — deterministic engine: tiers, bands, traces, portfolio.
          const engine = runEngine(storedStudent, assessment, SCHOOLS);

          // Step 3 — LLM explains the computed results in counselor language.
          const narrative = await callStructured(client, {
            system: NARRATIVE_SYSTEM_PROMPT,
            prompt: buildNarrativePrompt(storedStudent, assessment, engine, await researchPromise),
            toolName: 'submit_report',
            description: 'Submit the counselor strategy report grounded in the computed evaluations.',
            inputSchema: narrativeOutputJsonSchema(),
            zodSchema: narrativeOutputSchema,
            maxTokens: 20000,
          });

          const strategy = assembleStrategy(assessment, engine, narrative);

          // Server-side save: the result survives even if the client disconnects.
          const updatedStudent: Student = { ...storedStudent, status: 'Strategy Generated', updated: 'Just now' };
          const [stratWrite, studentWrite] = await Promise.all([
            supabase.from('strategies')
              .upsert({ student_id: studentId, user_id: user.id, data: strategy }, { onConflict: 'student_id,user_id' }),
            supabase.from('students')
              .upsert({ id: studentId, user_id: user.id, data: updatedStudent, updated_at: new Date().toISOString() }, { onConflict: 'id,user_id' }),
          ]);
          if (stratWrite.error) console.error('Server-side strategy save failed:', stratWrite.error);
          if (studentWrite.error) console.error('Server-side student status save failed:', studentWrite.error);

          controller.enqueue(encoder.encode(JSON.stringify(strategy)));
        } catch (err) {
          console.error('Strategy generation error:', err);
          controller.enqueue(encoder.encode(JSON.stringify({
            error: err instanceof Error ? err.message : 'Strategy generation failed',
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
    console.error('Strategy route error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Strategy generation failed' },
      { status: 500 },
    );
  }
}
