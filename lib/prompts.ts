import type { CourseYear, Student } from '@/types';
import { TIER_META } from './admissions/definitions';
import type { ProfileAssessment } from './admissions/assessment';
import type { EngineResult, SchoolEvaluation } from './admissions/engine';
import { getSchoolFacts } from './admissions/schoolFacts';

export interface SchoolResearchContext {
  school_name: string;
  program: string;
  admission_requirements: string;
  program_details: string;
  career_outcomes: string;
  community_insights: string;
  application_tips: string[];
  official_vs_community: string;
}

/* ── Shared profile serialization ──────────────────────────── */

export function serializeStudentProfile(student: Student): string {
  const activitiesSummary = student.activities.length
    ? student.activities
        .slice(0, 10)
        .map((a, i) => `  ${i + 1}. [${a.category}] ${a.position} at ${a.org} — ${a.desc} (${a.hours}h/wk, ${a.weeks}wk/yr, Grades ${a.grades.join(',') || 'not specified'}, ${a.timing || 'timing not specified'})`)
        .join('\n')
    : '  None listed';

  const awardsSummary = student.awards.length
    ? student.awards
        .slice(0, 5)
        .map(a => `  - ${a.title} (${a.level}, Grade ${a.grade})`)
        .join('\n')
    : '  None listed';

  const coursesSummary = student.courses && student.courses.length > 0
    ? (() => {
        const byYear = new Map<CourseYear, NonNullable<Student['courses']>>();
        for (const c of student.courses!) {
          const rows = byYear.get(c.year) ?? [];
          rows.push(c);
          byYear.set(c.year, rows);
        }
        return (['Pre-9', 9, 10, 11, 12] as CourseYear[])
          .filter(y => byYear.get(y)?.length)
          .map(y => {
            const rows = byYear.get(y)!.map(c =>
              `    ${c.level.padEnd(14)} ${c.name.padEnd(35)} S1: ${c.gradeSem1 || '—'}  S2: ${c.gradeSem2 || '—'}${c.apScore ? `  AP exam: ${c.apScore}` : ''}${c.credit !== undefined ? `  Credit: ${c.credit.toFixed(2)}` : ''}${c.transcriptCode ? `  Code: ${c.transcriptCode}` : ''}${c.notes ? `  Note: ${c.notes}` : ''}`
            ).join('\n');
            return `  ${y === 'Pre-9' ? 'Before Grade 9' : `Grade ${y}`}:\n${rows}`;
          }).join('\n');
      })()
    : null;

  const projectsSummary = student.projects && student.projects.length > 0
    ? student.projects
        .slice(0, 6)
        .map((p, i) => {
          const links = p.links?.length
            ? ` | Verifiable artifacts: ${p.links.map(l => `${l.type}${l.label ? ` (${l.label})` : ''}: ${l.url}`).join(', ')}`
            : ' | Verifiable artifacts: none provided';
          return `  ${i + 1}. [${p.type}/${p.field}] ${p.name}${p.affiliation ? ` (${p.affiliation})` : ''} — ${p.description} | Outcome: ${p.outcome}${p.impact ? ` | Impact: ${p.impact}` : ''}${links}`;
        })
        .join('\n')
    : null;

  const onlinePresence = [
    student.websiteUrl ? `- Personal website: ${student.websiteUrl}` : '',
    student.githubUrl ? `- GitHub: ${student.githubUrl}` : '',
    student.linkedinUrl ? `- LinkedIn: ${student.linkedinUrl}` : '',
  ].filter(Boolean).join('\n');

  const extendedProfile = [
    student.classRank ? `- Class rank: ${student.classRank}${student.classSize ? ` | Class size: ${student.classSize}` : ''}` : student.classSize ? `- Class size: ${student.classSize}` : '',
    student.gpaScale ? `- Weighted GPA scale: ${student.gpaScale}` : '',
    student.apIbOffered ? `- AP/IB courses offered by school: ${student.apIbOffered}` : '',
    student.schoolAvgSat ? `- School average SAT: ${student.schoolAvgSat}` : '',
    student.satMath || student.satReadingWriting ? `- SAT sections: Math ${student.satMath ?? 'N/A'} | Reading & Writing ${student.satReadingWriting ?? 'N/A'} | Superscore: ${student.satSuperscore ?? 'Unknown'}` : '',
    student.testOptionalPlan ? `- Score submission plan: ${student.testOptionalPlan}${student.plannedRetake ? ` | Planned retake: ${student.plannedRetake}` : ''}` : student.plannedRetake ? `- Planned retake: ${student.plannedRetake}` : '',
    student.englishTest ? `- English proficiency: ${student.englishTest}` : '',
    student.graduationProgram ? `- Graduation program: ${student.graduationProgram}` : '',
    student.endorsements?.length ? `- Endorsements: ${student.endorsements.join('; ')}` : '',
    student.seniorCourses ? `- Senior-year course plan: ${student.seniorCourses}` : '',
    student.academicTrend ? `- Academic trend/context: ${student.academicTrend}` : '',
    student.stateAssessments?.length ? `- State assessments: ${student.stateAssessments.join('; ')}` : '',
    student.performanceAcknowledgements?.length ? `- Transcript acknowledgements/certifications: ${student.performanceAcknowledgements.join('; ')}` : '',
    student.residencyStatus ? `- Residency/visa status: ${student.residencyStatus}` : '',
    student.stateResidency ? `- State residency: ${student.stateResidency}` : '',
    student.needBasedAid ? `- Need-based aid: ${student.needBasedAid}` : '',
    student.meritAidPriority ? `- Merit aid priority: ${student.meritAidPriority}` : '',
    student.annualBudget ? `- Annual family budget: ${student.annualBudget}` : '',
    student.parentEducation ? `- Parent/guardian education: ${student.parentEducation}` : '',
    student.familyResponsibilities ? `- Family/work responsibilities: ${student.familyResponsibilities}` : '',
    student.whyMajorEvidence ? `- Why-major evidence: ${student.whyMajorEvidence}` : '',
    student.personalStatementIdeas ? `- Personal statement ideas: ${student.personalStatementIdeas}` : '',
    student.backgroundContext ? `- Background context: ${student.backgroundContext}` : '',
    student.challengesContext ? `- Challenges/disruptions: ${student.challengesContext}` : '',
    student.additionalInformation ? `- Additional information plan: ${student.additionalInformation}` : '',
    student.recommenderPlan ? `- Recommendation plan: ${student.recommenderPlan}` : '',
    student.preferredRegions?.length ? `- Preferred regions: ${student.preferredRegions.join(', ')}` : '',
    student.excludedRegions?.length ? `- Excluded regions: ${student.excludedRegions.join(', ')}` : '',
    student.schoolMustHaves ? `- School must-haves: ${student.schoolMustHaves}` : '',
    student.schoolAvoids ? `- School deal-breakers: ${student.schoolAvoids}` : '',
  ].filter(Boolean).join('\n');

  return `STUDENT PROFILE:
- Name: ${student.name}
- Grade: ${student.grade}
- High School: ${student.school || 'Not specified'} (${student.schoolType})
- Location: ${student.city || 'Not specified'}
- GPA (weighted): ${student.gpa || 'Not provided'}${student.gpaUnweighted ? ` | GPA (unweighted): ${student.gpaUnweighted}` : ''}
- SAT: ${student.sat || 'Not taken'}
- ACT: ${student.act || 'Not taken'}
- AP/IB courses total: ${student.apCount}
- Intended major: ${student.major || 'Undecided'}
- Secondary interest: ${student.secondary || 'None'}
- Target range: ${student.targetRange}
- Risk appetite: ${student.risk}
- First-generation: ${student.firstGen}
- Citizenship: ${student.citizenship || 'Not specified'}
- Preferred schools: ${student.preferred || 'None specified'}
- Academic strengths: ${student.strengths.join(', ') || 'Not specified'}
- Known weaknesses: ${student.weak.join(', ') || 'None specified'}
${onlinePresence}
${extendedProfile}
${coursesSummary ? `\nTranscript (course-level detail):\n${coursesSummary}` : ''}
Activities:
${activitiesSummary}

Awards/Honors:
${awardsSummary}
${projectsSummary ? `\nResearch & Projects (HIGH SIGNAL for spike and major preparation):\n${projectsSummary}` : ''}
Positioning angles: ${student.angles || 'Not specified'}
Profile notes: ${student.traits || 'Not specified'}`;
}

/* ── Step 1: profile assessment ────────────────────────────── */

export const ASSESSMENT_SYSTEM_PROMPT = `You are a veteran U.S. college admissions counselor performing a structured first-read of a student file, the way a trained admissions officer would.

Your job is QUALITATIVE GRADING ONLY. You grade ten dimensions of the profile. You do NOT estimate admission probabilities, do NOT name schools, and do NOT give strategy — a downstream deterministic engine handles that using your grades.

Grading discipline:
- Every grade must cite specific evidence from the profile (name the course, the project, the award, the metric). No evidence, no grade above "solid".
- Grade curriculum rigor RELATIVE to what the high school offers: 9 APs at a school offering 10 is maximal rigor; 9 APs at a school offering 28 is not.
- Post-2023 (SFFA ruling) context: background and adversity now enter the file through essays and context fields. If backgroundContext / challenges / first-gen / family responsibilities contain usable narrative material, that affects narrative_coherence and institutional_fit grading — note when this material is being left unused.
- Distinguish the STUDENT from the APPLICATION: academic_readiness through narrative_coherence grade who the student is; application_readiness grades how complete the materials are (essays drafted? recommenders locked? test plan settled?). A strong student with unwritten essays is strong on the former and developing on the latter.
- Verification states (pick the strongest the evidence supports): externally_verified = award result, publication, or official record; institution_affiliated = a named school/university/company confirms participation; link_verified = a GitHub/site/demo URL exists but impact is not third-party-confirmed; self_reported_only = student's account with no anchor; conflicting_or_incomplete = materials disagree or key facts are missing.
- CRITICAL: self_reported_only means "not yet verified", NOT "low quality". Grade the tier on the substance described; express the uncertainty through verifiability + confidence + overstatement_risk, never by silently lowering the tier.
- Links are anchors, not proof of quality: a provided URL makes a claim checkable, but you cannot open it — never assume repo activity, video content, or paper venue beyond what the profile states. Note in "missing" when a strong claim lacks any link an AO could click.
- Be honest about what you cannot know. Use "missing", "assessment_gaps" and confidence levels aggressively. "Cannot reliably judge" is a valid and useful output.
- Err on the side of caution. The typical applicant pool at selective schools is brutally strong; "solid" is the honest median grade, not an insult.`;

export function buildAssessmentPrompt(student: Student): string {
  return `Perform your structured first-read of this student. Grade all ten dimensions with cited evidence, then submit via the tool.

${serializeStudentProfile(student)}`;
}

/* ── Step 3: counselor narrative over computed results ─────── */

export const NARRATIVE_SYSTEM_PROMPT = `You are a veteran U.S. college admissions counselor writing up a strategy report for a family.

You are given (a) a structured profile assessment and (b) COMPUTED school evaluations from a deterministic calibration engine: tiers, probability bands, adjustment traces, portfolio math, and early-round leverage grades. These numbers are AUTHORITATIVE — your job is to explain them in counselor language, not to change them.

Hard rules:
- NEVER invent, adjust, or restate probabilities beyond quoting the tiers/bands you were given.
- When explaining a school's placement, ground it in that school's actual trace factors (they are listed for you).
- Early rounds: use the strategic-value grades provided. Published ED/RD gaps carry selection bias — discuss ED as leverage and commitment, never as "multiplies your odds by N".
- Improvement levers describe qualitative effects on assessment dimensions with deadlines — never percentage-point claims.
- The plan works BACKWARD from deadlines (early rounds Nov 1, RD Jan 1); every month's tasks should name which application component they feed.
- Tone: professional, direct, specific. No "well-rounded student", no guaranteed-admission language, no fluff.
- All JSON string values must be single-line (no literal newlines).`;

function describeEvaluation(ev: SchoolEvaluation): string {
  const facts = getSchoolFacts(ev.schoolId);
  const edGrade = facts?.edStrategicValue?.value ?? 'unknown';
  const traceSummary = ev.trace
    .filter(t => t.stepDelta !== 0 || t.ruleId === 'base_rate' || t.ruleId === 'ed_opportunity')
    .map(t => `${t.stepDelta > 0 ? '+' : t.stepDelta < 0 ? '−' : '·'} ${t.label}`)
    .join('; ');
  return `- ${ev.short} [${ev.uiBucket.toUpperCase()}] → ${ev.tierLabel} (${ev.band.min}–${ev.band.max}%) | ED value: ${edGrade} | factors: ${traceSummary}${ev.flags.length ? ` | flags: ${ev.flags.join(', ')}` : ''}`;
}

export function buildNarrativePrompt(
  student: Student,
  assessment: ProfileAssessment,
  engine: EngineResult,
  researchContext?: SchoolResearchContext[],
): string {
  const dims = Object.entries(assessment.dimensions)
    .map(([k, d]) => `- ${k}: ${d.tier} (${d.verifiability}, confidence ${d.confidence}) — ${d.evidence[0] ?? 'no evidence cited'}`)
    .join('\n');

  const research = researchContext && researchContext.length > 0
    ? `\nSCHOOL RESEARCH DATA (official + community — use for school notes and strategy color):\n${researchContext.map(r => `[${r.school_name} — ${r.program}] ${r.admission_requirements} | ${r.community_insights} | Tips: ${r.application_tips.slice(0, 3).join('; ')}`).join('\n')}\n`
    : '';

  return `Write the strategy report for this family. Submit via the tool. School notes are required for EVERY school listed below, using the exact short names given.

${serializeStudentProfile(student)}

---

PROFILE ASSESSMENT (your colleague's structured first-read — cite it):
Spike: ${assessment.spike.has_spike ? `YES — ${assessment.spike.domain}. ${assessment.spike.summary}` : `No clear spike. ${assessment.spike.summary}`}
AO first read: ${assessment.profile_read}
Key risks: ${assessment.key_risks.join(' | ')}
Dimensions:
${dims}
Assessment gaps: ${assessment.assessment_gaps.join('; ') || 'none noted'}

---

COMPUTED SCHOOL EVALUATIONS — the student's own list (authoritative — explain, do not alter):
${engine.selected.map(describeEvaluation).join('\n')}
${engine.suggestions.length ? `
ENGINE-SUGGESTED ADDITIONS (not on the student's list — the engine proposes these to patch coverage gaps; reference them in ed_ea_strategy or bullets as recommendations to discuss with the family, and do NOT write school_notes for them):
${engine.suggestions.map(describeEvaluation).join('\n')}
` : ''}${engine.portfolio.unmatchedPreferred.length ? `
UNRESOLVED PREFERRED SCHOOLS: ${engine.portfolio.unmatchedPreferred.join(', ')} — these names could not be matched to the school database; mention in bullets that they were not analyzed.
` : ''}

PORTFOLIO MATH (authoritative):
- P(at least one admit): ${engine.portfolio.pAtLeastOne.lowerPct}–${engine.portfolio.pAtLeastOne.upperPct}% (${engine.portfolio.pAtLeastOne.note})
- Coverage: ${engine.portfolio.coverage.reach} reach / ${engine.portfolio.coverage.match} match / ${engine.portfolio.coverage.safety} safety
- Shutout risk: ${engine.portfolio.shutoutRisk}${engine.portfolio.warnings.length ? ` | warnings: ${engine.portfolio.warnings.join(', ')}` : ''}
- Computed competitiveness levels — Top 10: ${engine.portfolio.competitivenessLevels.top10}, Top 20: ${engine.portfolio.competitivenessLevels.top20}, Top 50: ${engine.portfolio.competitivenessLevels.top50}
${research}
Tier vocabulary for reference: ${Object.values(TIER_META).map(t => `${t.label} ${t.band.min}–${t.band.max}%`).join(', ')}.

Today's date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}. The student applies in the upcoming cycle — plan months must be real month names (e.g. "August 2026"), starting from today's month and running through the RD deadlines.`;
}
