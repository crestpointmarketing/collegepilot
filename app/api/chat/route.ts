import { NextRequest } from 'next/server';
import { getAnthropicClient } from '@/lib/ai';
import type { Student, Strategy } from '@/types';

export const runtime = 'edge';

function buildStudentContext(student: Student): string {
  const activities = student.activities.length
    ? student.activities.map(a => `  - [${a.category}] ${a.position} @ ${a.org}: ${a.desc} (${a.hours}h/wk)`).join('\n')
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
    const { messages, student, strategy, researchData }: {
      messages: { role: 'user' | 'assistant'; content: string }[];
      student: Student;
      strategy?: Strategy | null;
      researchData?: ResearchEntry[];
    } = await req.json();

    if (!messages?.length || !student) {
      return new Response('Missing messages or student', { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response('ANTHROPIC_API_KEY not configured', { status: 500 });
    }

    const sections = [
      buildStudentContext(student),
      strategy ? buildStrategyContext(strategy) : null,
      researchData?.length ? buildResearchContext(researchData) : null,
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
            messages,
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
          controller.enqueue(encoder.encode('\n\n[Error: response interrupted]'));
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
