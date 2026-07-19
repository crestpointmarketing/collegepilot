import { NextRequest, NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '@/lib/ai';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import { SCHOOLS } from '@/lib/schools';
import { getSchoolFacts } from '@/lib/admissions/schoolFacts';
import { serializeStudentProfile } from '@/lib/prompts';
import type { Student } from '@/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-5';

const reqSchema = z.object({
  studentId: z.string().trim().min(1).max(120),
  schoolId: z.string().trim().min(1).max(60),
});

/**
 * A single admissions-officer first-read of THIS student for THIS school.
 * Explicitly labeled AI simulation, grounded in the profile — never a claim
 * about what the real office will do.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = reqSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { studentId, schoolId } = parsed.data;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const school = SCHOOLS.find(s => s.id === schoolId);
    if (!school) return NextResponse.json({ error: 'Unknown school' }, { status: 404 });

    const { data: studentRow, error: studentError } = await supabase
      .from('students').select('data').eq('id', studentId).eq('user_id', user.id).maybeSingle();
    if (studentError) return NextResponse.json({ error: 'Could not load the student profile.' }, { status: 500 });
    if (!studentRow) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    const student = studentRow.data as Student;

    const rl = checkRateLimit(`ao:${user.id}`, 20, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ error: rateLimitMessage('AO perspective', rl) },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const facts = getSchoolFacts(schoolId);
    const schoolContext = [
      `${school.name} — overall admit rate ${school.accept}%, median SAT ${school.sat}.`,
      `What this school looks for: ${school.why}`,
      `Positioning angle: ${school.angle}`,
      facts?.csMajor ? `CS/engineering admission is ${facts.csMajor.value.competitiveness} and ${facts.csMajor.value.directAdmit ? 'direct-admit' : 'not gated by major'}.` : '',
    ].filter(Boolean).join('\n');

    const system = `You are simulating an experienced admissions officer at the named school doing a first read of one applicant. Write 3-5 sentences in an AO's voice: the dominant impression, how this student compares to that school's typical admitted pool for their intended area, the single most compelling element, and the single thing the committee would still want to see. Be specific to THIS school's priorities and THIS student's evidence. No score, no admit/deny verdict, no probability. Ground every claim in the supplied profile; if evidence is thin, say the committee would want more of it.`;

    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: MODEL, max_tokens: 600, system,
      messages: [{ role: 'user', content: `SCHOOL:\n${schoolContext}\n\nAPPLICANT:\n${serializeStudentProfile(student)}\n\nWrite the admissions officer's first-read impression.` }],
    });
    const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = block?.text.trim();
    if (!text) return NextResponse.json({ error: 'No perspective generated' }, { status: 502 });

    return NextResponse.json({ perspective: text, school: school.name, generatedAt: new Date().toISOString() });
  } catch (err) {
    // Log the detail server-side; return a generic message so provider/internal
    // detail never surfaces in the browser.
    console.error('AO perspective error:', err);
    return NextResponse.json({ error: 'Could not generate the perspective. Please try again.' }, { status: 500 });
  }
}
