import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { school, program } = await req.json();

    if (!school || !program) {
      return NextResponse.json({ error: 'Missing school or program' }, { status: 400 });
    }

    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json({ error: 'PERPLEXITY_API_KEY not configured' }, { status: 500 });
    }

    const systemPrompt = `You are a college admissions research analyst. Provide accurate, specific, up-to-date information about university programs. Always include real numbers (GPA ranges, SAT ranges, acceptance rates, salary figures) when available. Draw from both official university sources and genuine student community discussions (Reddit, College Confidential, forums).`;

    const userPrompt = `Research "${school}" — "${program}" program for a college admissions counselor.

Return ONLY valid JSON matching this exact schema (no markdown fences, no literal newlines inside string values):
{
  "admission_requirements": "string — specific GPA range, SAT/ACT ranges, class rank expectations, acceptance rate for this program, any portfolio or interview requirements",
  "program_details": "string — class size, curriculum highlights, unique features, research opportunities, co-op/internship integration, notable courses or tracks",
  "career_outcomes": "string — average starting salaries, top employers who recruit here, internship placement rates, graduate school acceptance rates",
  "community_insights": "string — honest student perspectives from Reddit and forums: what students love, common complaints, what surprised them, campus culture fit",
  "application_tips": ["string", "string", "string", "string", "string"],
  "official_vs_community": "string — where official claims differ from student experience, or 'Sources align' if consistent",
  "confidence": "High | Medium | Low"
}

Rules:
- Be specific with real numbers where available
- application_tips must be 5 actionable, program-specific items
- community_insights must reflect actual student opinions, not marketing language`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 3000,
        temperature: 0.2,
        return_citations: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Perplexity API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '';

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Perplexity returned no JSON');
    const result = JSON.parse(jsonMatch[0]);

    // citations come back as an array of URL strings in sonar-pro
    const citations: string[] = data.citations ?? [];
    const sources = citations.map((url: string) => ({
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
