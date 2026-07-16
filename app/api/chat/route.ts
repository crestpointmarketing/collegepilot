import { NextRequest } from 'next/server';
import { getAnthropicClient } from '@/lib/ai';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import { strategySchema } from '@/lib/schemas';
import type { Student, Strategy } from '@/types';
import { z } from 'zod';

export const runtime = 'edge';

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(8000),
  })).min(1).max(30),
  studentId: z.string().trim().min(1).max(120),
  strategy: strategySchema.nullable().optional(),
});

function buildStudentContext(student: Student): string {
  const activities = student.activities.length
    ? student.activities.map(a => `  - [${a.category}] ${a.position} @ ${a.org}: ${a.desc} (${a.hours}h/wk, Grades ${a.grades.join(',') || 'N/A'}, ${a.timing || 'timing N/A'})`).join('\n')
    : '  None listed';

  const awards = student.awards.length
    ? student.awards.map(a => `  - ${a.title} (${a.level}, Grade ${a.grade})`).join('\n')
    : '  None listed';

  const projects = student.projects?.length
    ? student.projects.map(p => `  - [${p.type}/${p.field}] ${p.name}${p.affiliation ? ` (${p.affiliation})` : ''}: ${p.description} | Outcome: ${p.outcome}${p.impact ? ` | Impact: ${p.impact}` : ''}`).join('\n')
    : '  None listed';

  const courses = student.courses?.length
    ? (() => {
        const byYear: Record<number, typeof student.courses> = {};
        for (const c of student.courses!) {
          if (!byYear[c.year]) byYear[c.year] = [];
          byYear[c.year]!.push(c);
        }
        return [9, 10, 11, 12]
          .filter(y => byYear[y]?.length)
          .map(y => `  Grade ${y}: ` + byYear[y]!.map(c =>
            `${c.level} ${c.name} (S1:${c.gradeSem1 || '—'} S2:${c.gradeSem2 || '—'}${c.apScore ? ` AP:${c.apScore}` : ''})`
          ).join(', ')).join('\n');
      })()
    : '  None listed';

  const additionalContext = [
    student.classRank ? `Class rank: ${student.classRank}${student.classSize ? ` / class size ${student.classSize}` : ''}` : student.classSize ? `Class size: ${student.classSize}` : '',
    student.gpaScale ? `Weighted GPA scale: ${student.gpaScale}` : '',
    student.apIbOffered ? `AP/IB offered by school: ${student.apIbOffered}` : '',
    student.satMath || student.satReadingWriting ? `SAT sections: Math ${student.satMath ?? 'N/A'}, Reading & Writing ${student.satReadingWriting ?? 'N/A'}, superscore ${student.satSuperscore ?? 'Unknown'}` : '',
    student.testOptionalPlan ? `Score plan: ${student.testOptionalPlan}${student.plannedRetake ? `; retake ${student.plannedRetake}` : ''}` : '',
    student.englishTest ? `English proficiency: ${student.englishTest}` : '',
    student.graduationProgram ? `Graduation program: ${student.graduationProgram}` : '',
    student.endorsements?.length ? `Endorsements: ${student.endorsements.join('; ')}` : '',
    student.seniorCourses ? `Senior courses: ${student.seniorCourses}` : '',
    student.academicTrend ? `Academic trend/context: ${student.academicTrend}` : '',
    student.stateAssessments?.length ? `State assessments: ${student.stateAssessments.join('; ')}` : '',
    student.performanceAcknowledgements?.length ? `Transcript acknowledgements: ${student.performanceAcknowledgements.join('; ')}` : '',
    student.residencyStatus ? `Residency/visa: ${student.residencyStatus}` : '',
    student.stateResidency ? `State residency: ${student.stateResidency}` : '',
    student.needBasedAid ? `Need-based aid: ${student.needBasedAid}` : '',
    student.meritAidPriority ? `Merit aid priority: ${student.meritAidPriority}` : '',
    student.annualBudget ? `Annual budget: ${student.annualBudget}` : '',
    student.parentEducation ? `Parent/guardian education: ${student.parentEducation}` : '',
    student.familyResponsibilities ? `Family/work responsibilities: ${student.familyResponsibilities}` : '',
    student.whyMajorEvidence ? `Why-major evidence: ${student.whyMajorEvidence}` : '',
    student.personalStatementIdeas ? `Personal statement ideas: ${student.personalStatementIdeas}` : '',
    student.backgroundContext ? `Background context: ${student.backgroundContext}` : '',
    student.challengesContext ? `Challenges/disruptions: ${student.challengesContext}` : '',
    student.additionalInformation ? `Additional information plan: ${student.additionalInformation}` : '',
    student.recommenderPlan ? `Recommendation plan: ${student.recommenderPlan}` : '',
    student.preferredRegions?.length ? `Preferred regions: ${student.preferredRegions.join(', ')}` : '',
    student.excludedRegions?.length ? `Excluded regions: ${student.excludedRegions.join(', ')}` : '',
    student.preferredSettings?.length ? `Preferred settings: ${student.preferredSettings.join(', ')}` : '',
    student.preferredSchoolSizes?.length ? `Preferred sizes: ${student.preferredSchoolSizes.join(', ')}` : '',
    student.schoolMustHaves ? `School must-haves: ${student.schoolMustHaves}` : '',
    student.schoolAvoids ? `School deal-breakers: ${student.schoolAvoids}` : '',
  ].filter(Boolean).join('\n');

  return `STUDENT PROFILE — ${student.name}
─────────────────────────────────────────
Grade: ${student.grade} | School: ${student.school || 'N/A'} (${student.schoolType}) | City: ${student.city || 'N/A'}
GPA (weighted): ${student.gpa || 'N/A'}${student.gpaUnweighted ? ` | GPA (unweighted): ${student.gpaUnweighted}` : ''}
SAT: ${student.sat || 'N/A'} | ACT: ${student.act || 'N/A'} | AP courses: ${student.apCount}
Major: ${student.major || 'Undecided'} | Secondary: ${student.secondary || 'None'}
Target: ${student.targetRange} | Risk: ${student.risk} | First-Gen: ${student.firstGen} | Citizenship: ${student.citizenship || 'N/A'}
Preferred schools: ${student.preferred || 'None specified'}
Strengths: ${student.strengths.join(', ') || 'N/A'}
Weaknesses: ${student.weak.join(', ') || 'None'}
Angles: ${student.angles || 'Not specified'}
Notes: ${student.traits || 'Not specified'}
${additionalContext ? `\nADDITIONAL PROFILE CONTEXT:\n${additionalContext}` : ''}

ACTIVITIES:
${activities}

AWARDS & HONORS:
${awards}

RESEARCH & PROJECTS:
${projects}

TRANSCRIPT:
${courses}`;
}

function buildStrategyContext(strategy: Strategy): string {
  const reach = strategy.schools.reach.map(s => `    ${s.name} — ${s.chance} — ${s.note}`).join('\n');
  const match = strategy.schools.match.map(s => `    ${s.name} — ${s.chance} — ${s.note}`).join('\n');
  const safety = strategy.schools.safety.map(s => `    ${s.name} — ${s.chance} — ${s.note}`).join('\n');

  const levers = strategy.meta?.improvement_levers?.map(l => `  • ${l}`).join('\n') ?? '';

  return `GENERATED STRATEGY
─────────────────────────────────────────
${strategy.meta ? `Overall success probability: ${strategy.meta.overall_success_probability}
Assessment: ${strategy.meta.assessment}

` : ''}Positioning type: ${strategy.positioning.type}
Identity: ${strategy.positioning.identity}
Strengths: ${strategy.positioning.strengths.join(' | ')}
Weaknesses: ${strategy.positioning.weaknesses.join(' | ')}

Competitiveness:
  Top 10: ${strategy.competitiveness.top10.level} — ${strategy.competitiveness.top10.note}
  Top 20: ${strategy.competitiveness.top20.level} — ${strategy.competitiveness.top20.note}
  Top 50: ${strategy.competitiveness.top50.level} — ${strategy.competitiveness.top50.note}
${strategy.competitiveness.bullets.map(b => `  • ${b}`).join('\n')}

School List:
  REACH:
${reach}
  MATCH:
${match}
  SAFETY:
${safety}

ED/EA: ${strategy.strategy.ed_ea}
Narrative: ${strategy.strategy.narrative}
${strategy.analysis ? `
Analysis:
  Spike: ${strategy.analysis.spike_assessment}
  Academic rigor: ${strategy.analysis.academic_rigor}
  Profile read: ${strategy.analysis.profile_read}
  Key risks: ${strategy.analysis.key_risks}` : ''}
${levers ? `\nImprovement levers:\n${levers}` : ''}`;
}

interface ResearchEntry {
  school_name: string;
  program: string;
  admission_requirements?: string;
  program_details?: string;
  career_outcomes?: string;
  community_insights?: string;
  application_tips?: string[];
  official_vs_community?: string;
  confidence?: string;
}

function buildResearchContext(research: ResearchEntry[]): string {
  if (!research.length) return '';
  return `SCHOOL RESEARCH DATA (from Perplexity AI — real-time sources)
─────────────────────────────────────────
${research.map(r => `[${r.school_name} — ${r.program}]
  Admission: ${r.admission_requirements ?? 'N/A'}
  Program: ${r.program_details ?? 'N/A'}
  Careers: ${r.career_outcomes ?? 'N/A'}
  Community: ${r.community_insights ?? 'N/A'}
  Tips: ${r.application_tips?.join(' | ') ?? 'N/A'}
  Official vs community: ${r.official_vs_community ?? 'N/A'}
  Confidence: ${r.confidence ?? 'N/A'}`).join('\n\n')}`;
}

export async function POST(req: NextRequest) {
  try {
    const parsedRequest = chatRequestSchema.safeParse(await req.json());
    if (!parsedRequest.success) {
      return new Response('Invalid chat request', { status: 400 });
    }
    const { messages, studentId, strategy } = parsedRequest.data;

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response('ANTHROPIC_API_KEY not configured', { status: 500 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response('Not authenticated', { status: 401 });
    }

    const rl = checkRateLimit(`chat:${user.id}`, 60, 60 * 60 * 1000);
    if (!rl.ok) {
      return new Response(rateLimitMessage('Chat', rl), {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      });
    }

    const { data: studentRow, error: studentError } = await supabase
      .from('students')
      .select('data')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (studentError) return new Response(studentError.message, { status: 500 });
    if (!studentRow) return new Response('Student not found', { status: 404 });

    const storedStudent = studentRow.data as Student;
    const { data: strategyRow } = await supabase
      .from('strategies')
      .select('data')
      .eq('student_id', storedStudent.id)
      .eq('user_id', user.id)
      .maybeSingle();
    const parsedStoredStrategy = strategySchema.safeParse(strategyRow?.data);
    const storedStrategy = parsedStoredStrategy.success ? parsedStoredStrategy.data : strategy ?? null;
    const firstUserMessage = messages.findIndex(message => message.role === 'user');
    const aiMessages = firstUserMessage >= 0 ? messages.slice(firstUserMessage) : messages;

    const { data: researchRows } = await supabase
      .from('school_research')
      .select('school_name, program, data')
      .eq('user_id', user.id);

    // Scope research to this student's target schools — the table is per-user,
    // so an unfiltered dump would mix other students' research into the context.
    const targetNames = [
      ...(storedStudent.preferred?.split(/[,;]/) ?? []),
      ...(storedStrategy
        ? [...storedStrategy.schools.reach, ...storedStrategy.schools.match, ...storedStrategy.schools.safety].map(s => s.name)
        : []),
    ].map(n => n.trim().toLowerCase()).filter(Boolean);

    const storedResearch: ResearchEntry[] = (researchRows ?? [])
      .filter(r => {
        if (!targetNames.length) return false;
        const school = r.school_name.toLowerCase();
        return targetNames.some(t => school.includes(t) || t.includes(school));
      })
      .map(r => ({
        school_name: r.school_name,
        program: r.program,
        ...(r.data ?? {}),
      }));

    const sections = [
      buildStudentContext(storedStudent),
      storedStrategy ? buildStrategyContext(storedStrategy) : null,
      storedResearch.length ? buildResearchContext(storedResearch) : null,
    ].filter(Boolean).join('\n\n');

    const systemPrompt = `You are an expert U.S. college admissions counselor advising on a specific student. You have their complete profile, any generated application strategy, and school research data below.

Reference the actual data when answering — be specific and data-driven. Do not repeat the full profile back; synthesize and apply it. Be honest about weaknesses. Give actionable advice.

Topics: admission chances, school fit, essay angles, activity descriptions, ED/EA timing, interview prep, scholarship strategy, narrative, and anything related to the college application process.

${sections}`;

    const client = getAnthropicClient();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: systemPrompt,
            messages: aiMessages,
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
          console.error('Chat stream error:', err);
          const status = (err as { status?: number })?.status;
          const detail =
            status === 401
              ? 'The Anthropic API key is invalid or missing. Update ANTHROPIC_API_KEY in .env.local and restart the server.'
              : status === 429
                ? 'The AI service is rate-limited right now. Try again in a moment.'
                : 'The response was interrupted. Please try again.';
          controller.enqueue(encoder.encode(`\n\n[AI error: ${detail}]`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
}
