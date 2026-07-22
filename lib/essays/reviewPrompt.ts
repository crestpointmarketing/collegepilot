/**
 * Prompts for the Essay Review (E3). AO-style critique: quoted sentences,
 * claim verification against the profile, question-based guidance — never
 * replacement prose.
 */
import type { Student, School } from '@/types';
import { serializeStudentProfile } from '@/lib/prompts';
import { getSchoolFacts } from '@/lib/admissions/schoolFacts';
import type { EssayAngle } from './types';

export const ESSAY_REVIEW_SYSTEM_PROMPT = `You are a veteran admissions reader giving a structured critique of a student's supplemental-essay draft for the Blueprint Method.

NON-NEGOTIABLE RULES:
1. NEVER write, rewrite, or suggest replacement text. No sample sentences, no "try something like...". Your only levers are diagnosis and QUESTIONS the student answers themselves.
2. Every rubric quote and claim quote must be copied VERBATIM from the draft — exact characters, no paraphrase, no ellipses inside the quote.
3. Claim verification is against the provided profile: confirmed only when the profile clearly backs it; needs_verification when plausible but undocumented; unsupported when nothing backs it; potentially_overstated when the profile supports a weaker version. School details the student asserts (labs, courses, professors) are needs_verification unless they appear in the provided school facts.
4. The AO first read is an honest first impression, not encouragement. Name what a tired reader would actually notice, good or bad.
5. At most 3 revision priorities — the highest-impact fixes only. Overwhelming a student with ten notes is a failure mode.
6. Judge the draft against THIS prompt and word limit, and against the student's selected angle when given: does the draft deliver the angle, or drift?`;

export function buildEssayReviewPrompt(opts: {
  student: Student;
  school: School;
  promptText: string;
  wordLimit?: number;
  essayText: string;
  selectedAngle: EssayAngle | null;
}): string {
  const { student, school, promptText, wordLimit, essayText, selectedAngle } = opts;
  const facts = getSchoolFacts(school.id);
  const factLines = facts
    ? Object.entries(facts)
        .map(([k, f]) => (f && typeof f === 'object' && 'value' in f ? `- ${k}: ${JSON.stringify((f as { value: unknown }).value)}` : null))
        .filter(Boolean).join('\n')
    : '(none on file)';

  return `Critique this draft. Quote verbatim, verify claims against the profile, and end with questions — never replacement text.

=== THE PROMPT (${school.name}${wordLimit ? ` · ${wordLimit} words` : ''}) ===
${promptText}

=== SELECTED ANGLE (the direction the student chose to test) ===
${selectedAngle ? `${selectedAngle.angle}\nEvidence it uses: ${selectedAngle.personalEvidence.join('; ')}\nSchool hook: ${selectedAngle.schoolHook}` : '(none selected — judge the draft on its own direction)'}

=== VERIFIED SCHOOL FACTS (everything else the essay says about the school needs verification) ===
${factLines}

=== STUDENT PROFILE (ground truth for claim verification) ===
${serializeStudentProfile(student)}

=== THE DRAFT (${essayText.trim().split(/\s+/).length} words) ===
${essayText}

Return the structured review: AO first read, the 5-dimension rubric (one verbatim quote each), every checkable claim with a status, at most 3 revision priorities, and next-draft questions.`;
}
