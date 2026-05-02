import { NextRequest, NextResponse } from 'next/server';
import { getExaClient } from '@/lib/exa';
import { getAnthropicClient } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { school, program } = await req.json();

    if (!school || !program) {
      return NextResponse.json({ error: 'Missing school or program' }, { status: 400 });
    }

    const exa = getExaClient();

    // Fast parallel search: official site + Reddit
    const [official, reddit] = await Promise.all([
      exa.searchAndContents(
        `${school} ${program} admission requirements GPA SAT acceptance rate`,
        { numResults: 4, text: { maxCharacters: 2000 }, type: 'auto' }
      ),
      exa.searchAndContents(
        `${school} ${program} reddit applicants students honest review`,
        { numResults: 4, text: { maxCharacters: 2000 }, includeDomains: ['reddit.com'], type: 'auto' }
      ),
    ]);

    const officialText = official.results
      .map(r => `[${r.title}](${r.url})\n${r.text ?? ''}`)
      .join('\n\n');
    const redditText = reddit.results
      .map(r => `[${r.title}](${r.url})\n${r.text ?? ''}`)
      .join('\n\n');

    const allText = `=== OFFICIAL SOURCES ===\n${officialText}\n\n=== REDDIT / COMMUNITY ===\n${redditText}`;

    const anthropic = getAnthropicClient();
    const mergePrompt = `You are analyzing research about "${school} ${program}" for a college admissions counselor.

Research content:
${allText.slice(0, 10000)}

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
- application_tips must be 5 actionable items specific to this program
- Output ONLY valid JSON, no markdown fences, no literal newlines inside string values`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: mergePrompt }],
    });

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('');

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude returned no JSON');
    const result = JSON.parse(jsonMatch[0]);

    const allResults = [...official.results, ...reddit.results];
    const sources = allResults.map(r => ({
      title: r.title || r.url,
      url: r.url,
      type: r.url.includes('reddit.com') ? 'reddit' : 'web',
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
