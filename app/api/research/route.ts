import { NextRequest, NextResponse } from 'next/server';
import { getExaClient } from '@/lib/exa';
import { getAnthropicClient } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { school, program } = await req.json();

    if (!school || !program) {
      return NextResponse.json({ error: 'Missing school or program' }, { status: 400 });
    }

    const exa = getExaClient();

    const instructions = `Research "${school} ${program}" comprehensively for a college admissions counselor.

1. Search the official ${school} website for: admission requirements (GPA, SAT/ACT ranges, acceptance rate, interview/portfolio requirements), program details (class size, curriculum, unique features, research opportunities, honors thesis), and career outcomes (salaries, top employers, internship rates, grad school placement).

2. Search Reddit (r/ApplyingToCollege, r/UTAustin or school-specific subreddits, r/college, r/cscareerquestions) for honest student perspectives on the program — what students love, hate, common complaints, realistic admission odds, and tips that worked.

3. Note any discrepancies between what the official site says vs what students report on Reddit.

Be specific with numbers wherever available (GPA 3.9+, SAT 1500+, $148K avg salary, 40 students per cohort, 95% placement rate, etc.).`;

    // Create and wait for Exa research
    const created = await exa.research.create({
      instructions,
      model: 'exa-research',
    });

    const finished = await exa.research.pollUntilFinished(created.researchId, {
      pollInterval: 4000,
    });

    // The actual output is at output.content (not output.text or output.json)
    const researchText = (finished as { output?: { content?: string } }).output?.content ?? '';

    if (!researchText) {
      return NextResponse.json({ error: 'Research returned no content' }, { status: 500 });
    }

    // Use Claude to convert the research text into structured JSON
    const anthropic = getAnthropicClient();
    const mergePrompt = `You are analyzing research about "${school} ${program}" for a college admissions counselor.

Research content:
${researchText.slice(0, 8000)}

Produce a final structured research summary as valid JSON matching this exact schema:
{
  "admission_requirements": "string — GPA range, SAT/ACT ranges, class rank, acceptance rate, interview/portfolio requirements. Be specific with numbers.",
  "program_details": "string — class size, curriculum structure, unique features, research opportunities, honors thesis requirements, notable courses",
  "career_outcomes": "string — average salaries, top employers, internship rates, graduate school placement rates",
  "community_insights": "string — honest student perspectives from Reddit and forums, common praises and complaints",
  "application_tips": ["string", "string", "string", "string", "string"],
  "official_vs_community": "string — where official claims differ from community experience, or 'Sources align' if no major discrepancies",
  "confidence": "High | Medium | Low — based on source quality and data specificity"
}

Rules:
- Be specific with numbers where available
- community_insights must reflect actual student opinions, not marketing
- application_tips must be 5–7 actionable items specific to this program
- Output ONLY valid JSON, no markdown fences`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: mergePrompt }],
    });

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('');

    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const result = JSON.parse(cleaned);

    // Extract source URLs from markdown links in the research text
    const urlPattern = /https?:\/\/[^\s\)]+/g;
    const urlMatches = [...new Set(researchText.match(urlPattern) ?? [])];
    const sources = urlMatches.slice(0, 10).map(url => ({
      title: url,
      url,
      type: url.includes('reddit.com') ? 'reddit' : 'web',
    }));

    return NextResponse.json({
      school,
      program,
      ...result,
      sources,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Research error:', error);
    return NextResponse.json({ error: 'Research failed', detail: String(error) }, { status: 500 });
  }
}
