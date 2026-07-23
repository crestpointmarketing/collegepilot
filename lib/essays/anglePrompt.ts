/**
 * Prompts for the Essay Angle Miner (E2).
 *
 * The miner surfaces DIRECTIONS, never prose. Angles must stay consistent with
 * the student's confirmed identity/direction and may only cite evidence that
 * exists in the profile. School traits without a provided fact are unverified.
 */
import type { Student, School } from '../../types';
import { serializeStudentProfile, serializeConfirmedFocus } from '../prompts';
import { getSchoolFacts } from '../admissions/schoolFacts';
import type { Blueprint } from '../admissions/blueprint';

export const ANGLE_MINER_SYSTEM_PROMPT = `You are an essay strategist for the Blueprint Method. You mine ANGLES for a specific supplemental-essay prompt — you never write essay content.

NON-NEGOTIABLE RULES:
1. NEVER write essay prose, openers, thesis sentences, or any text a student could paste into a draft. Angles are directions to test, phrased as strategy, not copy.
2. personalEvidence must name ONLY items that literally exist in the profile (activity, project, or award names). Inventing or embellishing evidence is disqualifying.
3. Every angle must be consistent with the student's confirmed identity and academic direction (when provided) and with the Blueprint master line. Never build a different persona for a different school.
4. School traits: if the trait is in the provided SCHOOL FACTS, mark schoolHookStatus verified. Anything else you believe about the school (labs, professors, courses, mottos) is unverified — say so, and phrase it as something the student must confirm on the official page. Never state an unverified trait as fact.
5. Be honest about risks: how often readers see this move (cliché), and where it would overlap the Common App essay or sibling supplementals listed.
6. Each angle ends in open questions the STUDENT must answer — the essay comes from their answers, not from you.
7. Every angle is a working hypothesis for the student to react to. Diversity matters: the 3–4 angles should take genuinely different doors into the prompt, not variations of one idea. Keep each field tight and concrete — no padding.`;

export function buildAngleMinerPrompt(opts: {
  student: Student;
  school: School;
  program: string | null;
  promptText: string;
  wordLimit?: number;
  blueprint: Blueprint | null;
  existingAngles: string[];
  siblingEssayTopics: string[];
}): string {
  const { student, school, program, promptText, wordLimit, blueprint, existingAngles, siblingEssayTopics } = opts;
  const facts = getSchoolFacts(school.id);

  const factLines = facts
    ? Object.entries(facts)
        .map(([k, f]) => (f && typeof f === 'object' && 'value' in f ? `- ${k}: ${JSON.stringify((f as { value: unknown }).value)}` : null))
        .filter(Boolean)
        .join('\n')
    : '(none on file — every school trait you use is unverified)';

  // Old blueprints may predate the narrative volume — access defensively.
  const nar = blueprint?.narrative;
  const blueprintBlock = blueprint
    ? `BLUEPRINT NARRATIVE SYSTEM (authoritative for story coherence):
- Master line: ${nar?.masterLine || blueprint.thesis || blueprint.identity?.coreIdentity || '(none)'}
- Core identity: ${blueprint.identity?.coreIdentity ?? '(none)'}
- School emphasis on file: ${(nar?.schoolEmphasis ?? []).map(s => `${s.context}: ${s.emphasis}`).join(' | ') || '(none)'}
- Common App directions already planned: ${(nar?.commonAppDirections ?? []).map(d => d.direction).join(' | ') || '(none)'}`
    : 'BLUEPRINT: not generated yet — anchor to the confirmed focus below and the raw evidence.';

  return `Mine 3–4 essay ANGLES for the prompt below. Directions to test, never prose.

=== THE PROMPT (${school.name}${program ? ` · ${program}` : ''}${wordLimit ? ` · ${wordLimit} words` : ''}) ===
${promptText}

=== SCHOOL BASICS ===
${school.name} (${school.short}) · ${school.city}, ${school.state} · ${school.type} · known majors: ${school.majors.join(', ')}
SCHOOL FACTS (the ONLY verified traits):
${factLines}

${blueprintBlock}

=== STUDENT PROFILE (the only allowed evidence) ===
${serializeStudentProfile(student)}
${serializeConfirmedFocus(student)}
=== ALREADY EXPLORED / IN USE (avoid duplicating) ===
Existing angles for this prompt: ${existingAngles.length ? existingAngles.join(' | ') : '(none)'}
Topics used by this student's other essays: ${siblingEssayTopics.length ? siblingEssayTopics.join(' | ') : '(none)'}

Return 3–4 genuinely different angles. Cite evidence by its exact profile name. Mark every school trait not in SCHOOL FACTS as unverified.`;
}
