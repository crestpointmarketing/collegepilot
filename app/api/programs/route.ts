import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient } from '@/lib/ai';
import { createServerSupabaseClient } from '@/lib/supabase.server';
import { checkRateLimit, rateLimitMessage } from '@/lib/rateLimit';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ProgramEntry {
  name: string;
  category: 'Major' | 'Honors Program' | 'Certificate' | 'Special Track' | 'Interdisciplinary Program' | 'Minor' | 'Other';
  department?: string;
  source_url: string;
  source_title?: string;
  confidence: 'High' | 'Medium' | 'Low';
}

interface FirecrawlSearchResult {
  title?: string;
  description?: string;
  url?: string;
  markdown?: string;
}

interface DatabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const schoolNameSchema = z.string().trim().min(1).max(160);
const programsRequestSchema = z.object({
  school: schoolNameSchema,
  force: z.boolean().optional().default(false),
});

function errorToMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const dbError = err as DatabaseError;
    const pieces = [dbError.message, dbError.details, dbError.hint].filter(Boolean);
    if (pieces.length) return pieces.join(' ');
  }
  return fallback;
}

function isMissingProgramCacheError(err: DatabaseError | null) {
  return err?.code === '42P01' || err?.code === '42703';
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in extractor response');
  return JSON.parse(match[0].replace(/,\s*([}\]])/g, '$1'));
}

function isLikelyOfficialUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith('.edu') || host.includes('admissions.') || host.includes('catalog.');
  } catch {
    return false;
  }
}

function inferCategory(name: string): ProgramEntry['category'] {
  const lower = name.toLowerCase();
  if (lower.includes('honors') || lower.includes('scholars')) return 'Honors Program';
  if (lower.includes('certificate')) return 'Certificate';
  if (lower.includes('minor')) return 'Minor';
  if (lower.includes('track') || lower.includes('concentration') || lower.includes('specialization')) return 'Special Track';
  if (lower.includes('interdisciplinary')) return 'Interdisciplinary Program';
  return 'Major';
}

function normalizeProgramName(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+[|–-]\s+.*$/g, '')
    .replace(/\s*\((?:BA|B\.A\.|BS|B\.S\.|BFA|B\.F\.A\.|Minor|Certificate)\)\s*$/i, '')
    .replace(/\b(?:Bachelor of Arts|Bachelor of Science|Undergraduate Degree|Degree Program)\b/gi, '')
    .replace(/^[\-*•·\s]+/, '')
    .replace(/[\s:;,.]+$/, '')
    .trim();
}

function isUsefulProgramCandidate(name: string): boolean {
  if (name.length < 3 || name.length > 80) return false;
  if (!/[a-z]/i.test(name)) return false;
  const lower = name.toLowerCase();
  const noiseExact = [
    'undergraduate degrees',
    'graduate degrees',
    'law degrees',
    'medical degrees',
    'degree',
    'degrees',
  ];
  const noiseContains = [
    'chatting',
    'cookie',
    'copyright',
    'facebook',
    'instagram',
    'linkedin',
    'privacy',
    'explore ',
    'graduate degrees',
    'law degrees',
    'student ',
    'students ',
    'studying',
    'two students',
    'undergrad degrees',
    'undergraduate degrees',
    'twitter',
    'youtube',
  ];
  if (noiseExact.includes(lower)) return false;
  if (noiseContains.some(term => lower.includes(term))) return false;
  if (/\b(degrees?|admissions?|requirements?|tuition|financial aid)\b$/i.test(name)) return false;
  const blocked = [
    'apply', 'admission', 'admissions', 'academics', 'areas of study', 'catalog',
    'college', 'college of liberal arts', 'college of natural sciences', 'contact', 'degree', 'degrees', 'explore', 'graduate', 'home',
    'law degree', 'medical degree', 'overview', 'programs', 'request info',
    'search', 'skip to main content', 'undergraduate', 'view all',
  ];
  if (blocked.some(term => lower === term || lower.includes(`${term} |`))) return false;
  if (name.includes('http') || name.includes('[') || name.includes(']')) return false;
  if (/^(about|back|campus|connect|current|faculty|future|menu|news|office|resources|students)$/i.test(name)) return false;
  if (/^\d/.test(name)) return false;
  return true;
}

function addProgramCandidate(
  entries: ProgramEntry[],
  seen: Set<string>,
  rawName: string,
  page: FirecrawlSearchResult,
  confidence: ProgramEntry['confidence'],
) {
  const name = normalizeProgramName(rawName);
  if (!page.url || !isUsefulProgramCandidate(name)) return;
  const key = name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  entries.push({
    name,
    category: inferCategory(name),
    source_url: page.url,
    source_title: page.title ?? '',
    confidence,
  });
}

function extractProgramsLocally(pages: FirecrawlSearchResult[]): ProgramEntry[] {
  const entries: ProgramEntry[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const text = [page.description ?? '', page.markdown ?? ''].join('\n');

    {
    const descriptionParts = (page.description ?? '').split(/[·•;|]/);
    for (const part of descriptionParts) {
      addProgramCandidate(entries, seen, part, page, 'High');
    }

    }

    for (const match of text.matchAll(/\[([^\]\n]{3,90})\]\([^)]+\)/g)) {
      addProgramCandidate(entries, seen, match[1], page, 'High');
    }

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      const bullet = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.{3,90})$/);
      if (bullet) addProgramCandidate(entries, seen, bullet[1], page, 'Medium');
    }

    const descriptionParts = (page.description ?? '').split(/[·•;|]/);
    void descriptionParts;
  }

  return entries.slice(0, 40);
}

async function firecrawlSearch(school: string): Promise<FirecrawlSearchResult[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not configured');

  const queries = [
    `"${school}" undergraduate majors official`,
    `"${school}" undergraduate catalog degree programs`,
    `"${school}" honors program undergraduate official`,
  ];

  const batches = await Promise.all(queries.map(async query => {
    const res = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 4,
        sources: ['web'],
        country: 'US',
        timeout: 20000,
        scrapeOptions: {
          formats: [{ type: 'markdown' }],
          onlyMainContent: true,
          removeBase64Images: true,
          blockAds: true,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        throw new Error('Firecrawl authentication failed. Check FIRECRAWL_API_KEY and restart the local server.');
      }
      throw new Error(`Firecrawl search failed ${res.status}: ${text.slice(0, 240)}`);
    }
    const json = await res.json();
    const searchResults = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.data?.web)
        ? json.data.web
        : [];
    return searchResults as FirecrawlSearchResult[];
  }));

  const results = batches.flat();

  const seen = new Set<string>();
  return results
    .filter(r => r.url && isLikelyOfficialUrl(r.url))
    .filter(r => {
      const key = r.url!.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

async function extractPrograms(school: string, pages: FirecrawlSearchResult[]): Promise<ProgramEntry[]> {
  if (pages.length === 0) return [];
  const localPrograms = extractProgramsLocally(pages);
  if (localPrograms.length >= 8 || !process.env.ANTHROPIC_API_KEY) return localPrograms;

  const sourceText = pages.map((p, i) => `
SOURCE ${i + 1}
Title: ${p.title ?? 'Untitled'}
URL: ${p.url}
Description: ${p.description ?? ''}
Markdown:
${(p.markdown ?? '').slice(0, 7000)}
`).join('\n\n');

  const prompt = `Extract undergraduate programs for "${school}" from the official-source snippets below.

Return ONLY valid JSON:
{
  "programs": [
    {
      "name": "string",
      "category": "Major | Honors Program | Certificate | Special Track | Interdisciplinary Program | Minor | Other",
      "department": "string or empty",
      "source_url": "exact source URL from the snippets",
      "source_title": "source title",
      "confidence": "High | Medium | Low"
    }
  ]
}

Rules:
- Include undergraduate majors, honors programs, interdisciplinary programs, certificates, special tracks, and minors.
- Prefer official catalog/admissions/department pages.
- Do not invent programs. Every program must have a source_url from the snippets.
- Merge duplicates by canonical program name.
- Keep names concise and suitable for a dropdown.
- Return at most 40 programs.

${sourceText}`;

  try {
    const client = getAnthropicClient();
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 5000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');
    const parsed = extractJson(text) as { programs?: ProgramEntry[] };

    const seen = new Set<string>();
    const aiPrograms = (parsed.programs ?? [])
      .filter(p => p.name && p.source_url && isLikelyOfficialUrl(p.source_url))
      .filter(p => {
        const key = `${p.name.toLowerCase()}|${p.source_url.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 40);

    return aiPrograms.length ? aiPrograms : localPrograms;
  } catch (err) {
    console.warn('Program AI extraction failed, using local extraction:', errorToMessage(err, 'AI extraction failed'));
    return localPrograms;
  }
}

export async function GET(req: NextRequest) {
  try {
    const parsedSchool = schoolNameSchema.safeParse(req.nextUrl.searchParams.get('school'));
    if (!parsedSchool.success) return NextResponse.json({ error: 'Invalid school name' }, { status: 400 });
    const school = parsedSchool.data;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabase
      .from('school_programs')
      .select('program_name, category, department, source_url, source_title, confidence, fetched_at')
      .eq('user_id', user.id)
      .ilike('school_name', school);

    if (error) {
      if (isMissingProgramCacheError(error)) {
        return NextResponse.json({
          school,
          cached: true,
          programs: [],
          warning: 'school_programs cache table is not ready',
        });
      }
      throw error;
    }
    return NextResponse.json({
      school,
      cached: true,
      programs: (data ?? []).filter(row => isUsefulProgramCandidate(row.program_name)).map(row => ({
        name: row.program_name,
        category: row.category,
        department: row.department ?? '',
        source_url: row.source_url,
        source_title: row.source_title ?? '',
        confidence: row.confidence,
        fetched_at: row.fetched_at,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: errorToMessage(err, 'Failed to load programs') }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsedRequest = programsRequestSchema.safeParse(await req.json());
    if (!parsedRequest.success) return NextResponse.json({ error: 'Invalid program request' }, { status: 400 });
    const { school: schoolName, force } = parsedRequest.data;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    if (!force) {
      const { data: existing, error: existingError } = await supabase
        .from('school_programs')
        .select('program_name, category, department, source_url, source_title, confidence, fetched_at')
        .eq('user_id', user.id)
        .ilike('school_name', schoolName)
        .gte('fetched_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString());
      if (existingError && !isMissingProgramCacheError(existingError)) throw existingError;
      const cleanExisting = (existing ?? []).filter(row => isUsefulProgramCandidate(row.program_name));
      if (cleanExisting.length) {
        return NextResponse.json({
          school: schoolName,
          cached: true,
          programs: cleanExisting.map(row => ({
            name: row.program_name,
            category: row.category,
            department: row.department ?? '',
            source_url: row.source_url,
            source_title: row.source_title ?? '',
            confidence: row.confidence,
            fetched_at: row.fetched_at,
          })),
        });
      }
    }

    // Cache miss or forced refresh — this is the expensive path (3 Firecrawl fetches + possible AI extraction)
    const rl = checkRateLimit(`programs:${user.id}`, 10, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: rateLimitMessage('Program fetching', rl) },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    const pages = await firecrawlSearch(schoolName);
    const programs = await extractPrograms(schoolName, pages);
    let warning = '';
    if (programs.length) {
      const rows = programs.map(p => ({
        user_id: user.id,
        school_name: schoolName,
        program_name: p.name,
        category: p.category,
        department: p.department ?? '',
        source_url: p.source_url,
        source_title: p.source_title ?? '',
        confidence: p.confidence,
        data: p,
        fetched_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from('school_programs')
        .upsert(rows, { onConflict: 'user_id,school_name,program_name,source_url' });
      if (error) {
        if (isMissingProgramCacheError(error)) {
          warning = 'school_programs cache table is not ready; programs were loaded live but not cached.';
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({
      school: schoolName,
      cached: false,
      sources: pages.map(p => ({ title: p.title, url: p.url })),
      programs,
      warning,
    });
  } catch (err) {
    console.error('Programs fetch error:', err);
    return NextResponse.json({ error: errorToMessage(err, 'Failed to fetch programs') }, { status: 500 });
  }
}
