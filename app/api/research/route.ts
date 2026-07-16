import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Cached research younger than this is returned without a new Perplexity call.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const researchRequestSchema = z.object({
  school: z.string().trim().min(1).max(160),
  program: z.string().trim().min(1).max(240),
  force: z.boolean().optional().default(false),
});

function parseJsonFromModel(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Perplexity returned no JSON');

  const cleaned = jsonMatch[0]
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u0000-\u001F]+/g, ' ');
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const parsedRequest = researchRequestSchema.safeParse(await req.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Invalid school or program' }, { status: 400 });
    }
    const { school, program, force } = parsedRequest.data;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Serve from cache unless the user explicitly asks for fresh research
    if (!force) {
      const { data: cachedRow } = await supabase
        .from('school_research')
        .select('data, generated_at')
        .eq('user_id', user.id)
        .eq('school_name', school)
        .eq('program', program)
        .maybeSingle();
      const generatedAt = cachedRow?.generated_at ? new Date(cachedRow.generated_at).getTime() : 0;
      if (cachedRow?.data && Date.now() - generatedAt < CACHE_TTL_MS) {
        return NextResponse.json({ ...cachedRow.data, cached: true });
      }
    }

    const rl = checkRateLimit(`research:${user.id}`, 15, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: rateLimitMessage('School research', rl) },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json({ error: 'PERPLEXITY_API_KEY not configured' }, { status: 500 });
    }

    const systemPrompt = [
      'You are a college admissions research analyst for counselors.',
      'Prioritize official university pages, Common Data Set pages, catalogs, admissions pages, and credible student-community sources.',
      'Use specific numbers when available. If a value is not found, write "Not found" rather than guessing.',
      'Return clean JSON only. Do not use markdown, citations inside strings, tables, or escaped formatting.',
    ].join(' ');

    const userPrompt = `Research "${school}" - "${program}" for a college admissions counselor.

Return ONLY valid JSON matching this exact schema:
{
  "summary": {
    "admissions": "one short sentence",
    "program": "one short sentence",
    "outcomes": "one short sentence",
    "student_view": "one short sentence"
  },
  "structured_research": {
    "requirements": {
      "gpa": "GPA range or Not found",
      "sat_act": "SAT/ACT range, test policy, or Not found",
      "selectivity": "overall/program acceptance rate or Not found",
      "coursework": "recommended/required high school coursework",
      "portfolio_interview": "portfolio, interview, audition, essay, or Not found",
      "deadlines": "EA/ED/RD/program deadlines or Not found",
      "notes": "important admissions nuance"
    },
    "program_details": {
      "curriculum": "curriculum summary",
      "tracks": "tracks, concentrations, honors paths, or Not found",
      "research": "research access and labs",
      "class_size": "cohort/class size or Not found",
      "special_features": "distinctive features"
    },
    "outcomes": {
      "starting_salary": "salary or Not found",
      "employers": "top employers or Not found",
      "internships": "internship/co-op placement info or Not found",
      "grad_school": "grad school placement or Not found",
      "career_paths": "common paths"
    },
    "community": {
      "student_sentiment": "overall student sentiment",
      "strengths": "what students praise",
      "complaints": "common complaints",
      "culture_fit": "who fits well",
      "reddit_notes": "specific Reddit/forum insight or Not found"
    },
    "official_vs_community": {
      "alignment": "where official and community sources agree",
      "gaps": "where they differ or Not found",
      "confidence_notes": "why confidence is High, Medium, or Low"
    }
  },
  "admission_requirements": "readable paragraph synthesized from structured_research.requirements",
  "program_details": "readable paragraph synthesized from structured_research.program_details",
  "career_outcomes": "readable paragraph synthesized from structured_research.outcomes",
  "community_insights": "readable paragraph synthesized from structured_research.community",
  "application_tips": ["five actionable counselor-facing tips"],
  "official_vs_community": "readable paragraph synthesized from structured_research.official_vs_community",
  "confidence": "High | Medium | Low"
}

Rules:
- Every key must be present.
- Use "Not found" for missing facts.
- Keep each structured field under 35 words.
- Keep summary fields under 22 words.
- Application tips must be specific to the school/program.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(50_000),
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4000,
        temperature: 0.1,
        return_citations: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Perplexity API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '';
    const result = parseJsonFromModel(raw) as Record<string, unknown>;
    const citations: string[] = data.citations ?? [];
    const sources = citations.map((url: string) => ({
      title: url,
      url,
      type: url.includes('reddit.com') ? 'reddit' : 'web',
    }));

    const payload = {
      school,
      program,
      ...result,
      sources,
      generated_at: new Date().toISOString(),
    };

    // Persist automatically so results survive navigation and later runs hit the cache.
    // Best-effort: a failed write shouldn't discard research the user just paid for.
    const { error: saveError } = await supabase.from('school_research').upsert({
      user_id: user.id,
      school_name: school,
      program,
      data: payload,
      generated_at: payload.generated_at,
    }, { onConflict: 'user_id,school_name,program' });
    if (saveError) console.error('school_research upsert failed:', saveError);

    return NextResponse.json({ ...payload, cached: false, saved: !saveError });
  } catch (error) {
    console.error('Research error:', error);
    return NextResponse.json({ error: 'Research failed' }, { status: 500 });
  }
}
