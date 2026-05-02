import type { Student } from '@/types';
import { SCHOOLS } from './schools';

// Data sourced from: Common Data Set submissions, USNWR, school admissions offices.
// csAccept = CS/engineering program-specific admit rate (where available and publicly reported).
function buildSchoolReferenceTable(): string {
  const rows = SCHOOLS.map(s => {
    const majors = s.majors.slice(0, 2).join(', ');
    const acceptStr = s.csAccept != null
      ? `${s.accept}% (CS:${s.csAccept}%)`
      : `${s.accept}%`;
    return `| ${s.short.padEnd(16)} | ${s.type.padEnd(7)} | ${acceptStr.padEnd(14)} | ${String(s.sat).padEnd(8)} | ${String(s.gpa).padEnd(8)} | #${String(s.ranking).padEnd(3)} | ${majors}`;
  });
  return [
    '| School           | Type    | Accept (CS-specific)  | Med SAT  | Med GPA  | Rank | Top Majors',
    '|------------------|---------|----------------------|----------|----------|------|------------',
    ...rows,
  ].join('\n');
}

export const STRATEGY_SYSTEM_PROMPT = `You are an elite U.S. college admissions strategist AND decision optimization engine.

Your responsibility is NOT to give generic advice.
Your responsibility is to:
1) Estimate admission probability for each school
2) Optimize the overall application strategy
3) Maximize the probability of at least one strong admission
4) Provide actionable improvements that increase success probability

You must think like:
- An admissions officer (evaluation)
- A strategist (portfolio construction)
- A consultant (clear recommendations)

Be precise, structured, and decisive. No fluff.

---

STEP 1: FEATURE NORMALIZATION

For the student:
- Normalize Academic strength (0–1)
- Normalize Spike strength (0–1)
- Estimate Activity impact (0–1)
- Estimate Essay quality (0–1, assume reasonable if missing)
- Estimate Recommendation strength (0–1, assume reasonable if missing)
- Compute Alignment score (major + narrative consistency)

For each school:
- Compute Selectivity pressure using acceptance rate
- Determine Program fit

---

STEP 2: ADMISSION PROBABILITY MODEL

For each school, compute Z score:

Z =
  1.1 * Academic
+ 1.1 * Spike
+ 0.8 * Program Fit
+ 0.6 * Activity
+ 0.5 * Essay
+ 0.5 * Recommendation
+ 0.4 * Alignment
- 1.5 * Selectivity
+ Context Adjustment

Then compute: P = 1 / (1 + exp(-Z))

Apply calibration multipliers (HARD RULE — apply always):
- Acceptance rate < 5%  → multiply P by 0.45 (max 12% for any applicant)
- Acceptance rate 5–8%  → multiply P by 0.55 (max 18% for any applicant)
- Acceptance rate 8–15% → multiply P by 0.65 (max 28% for any applicant)
- Acceptance rate 15–30% → multiply P by 0.80
- Acceptance rate > 30%  → multiply P by 1.1 (cap at 0.88)

ADDITIONAL SAT PENALTY:
- If student SAT is below school's median SAT → multiply by additional 0.80
- If student SAT is more than 60 pts below median → multiply by additional 0.65

CALIBRATION RULE — use the CS-specific accept rate (shown as "CS:X%" in the school table above) when computing Selectivity pressure. If only the overall rate is available, use that. The CS-specific rates come from Common Data Set submissions and school admissions offices.

For any school where the CS accept rate is under 10%: your final P% for that school must not exceed 2.5× the CS accept rate (e.g. CS accept 7% → P max 17.5%). For schools under 5% CS accept, max P is 2× the CS accept rate.

---

STEP 3: CLASSIFICATION

- If acceptance rate < 8% → always Reach regardless of P
- Else:
  - P < 15% → Reach
  - 15–35% → Match
  - >35% → Safety

---

STEP 4: PORTFOLIO OPTIMIZATION

Construct list:
- 2–4 Reach
- 3–5 Match
- 2–3 Safety

Compute: P(at least one acceptance) = 1 - Π(1 - P_i)

Identify and fix issues: over-concentration, weak Safety coverage, ED/EA opportunities.

---

IMPORTANT RULES:
- NEVER output a probability higher than the real-world benchmark max for that school tier
- Do NOT be optimistic without justification — err on the side of caution
- A student with SAT below school median should ALWAYS have lower P than a student above median
- Always tie reasoning to student inputs
- Keep tone professional and analytical
- Focus on decision-making, not description`;

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

export function buildStrategyPrompt(student: Student, researchContext?: SchoolResearchContext[]): string {
  const activitiesSummary = student.activities.length
    ? student.activities
        .slice(0, 10)
        .map((a, i) => `  ${i + 1}. [${a.category}] ${a.position} at ${a.org} — ${a.desc} (${a.hours}h/wk, ${a.weeks}wk/yr, Grades ${a.grades.join(',')})`)
        .join('\n')
    : '  None listed';

  const awardsSummary = student.awards.length
    ? student.awards
        .slice(0, 5)
        .map(a => `  - ${a.title} (${a.level}, Grade ${a.grade})`)
        .join('\n')
    : '  None listed';

  const spikeHint = student.awards.some(a => a.level === 'National' || a.level === 'International')
    ? 'A (national-level recognition)'
    : student.activities.length >= 3
    ? 'B (strong consistent involvement)'
    : 'C (developing)';

  const schoolTable = buildSchoolReferenceTable();

  // Compute per-school stat deltas to help Claude calibrate
  const satNum = parseInt(student.sat) || 0;
  const gpaNum = parseFloat(student.gpa) || 0;
  const schoolDeltas = SCHOOLS.map(s => {
    const satDelta = satNum - s.sat;
    const gpaDelta = gpaNum - s.gpa;
    return `  ${s.short}: SAT ${satDelta >= 0 ? '+' : ''}${satDelta} vs median, GPA ${gpaDelta >= 0 ? '+' : ''}${gpaDelta.toFixed(2)} vs median`;
  }).join('\n');

  return `Run your full 8-step analysis on this student. Then output ONLY valid JSON — no prose, no markdown fences outside the JSON.

SCHOOL REFERENCE DATABASE — you MUST anchor every P% estimate to these real statistics:
${schoolTable}

STUDENT vs SCHOOL STAT DELTAS (positive = student above median):
${schoolDeltas}

STUDENT PROFILE:
- Name: ${student.name}
- Grade: ${student.grade}
- High School: ${student.school || 'Not specified'} (${student.schoolType})
- Location: ${student.city || 'Not specified'}
- GPA: ${student.gpa || 'Not provided'} (${student.gpaType})
- SAT: ${student.sat || 'Not taken'}
- ACT: ${student.act || 'Not taken'}
- AP/IB courses: ${student.apCount}
- Intended major: ${student.major || 'Undecided'}
- Secondary interest: ${student.secondary || 'None'}
- Spike tier (estimated): ${spikeHint}
- Target range: ${student.targetRange}
- Risk appetite: ${student.risk}
- First-generation: ${student.firstGen}
- Citizenship: ${student.citizenship || 'Not specified'}
- Preferred schools: ${student.preferred || 'None specified'}
- Academic strengths: ${student.strengths.join(', ') || 'Not specified'}
- Known weaknesses: ${student.weak.join(', ') || 'None specified'}

Activities:
${activitiesSummary}

Awards/Honors:
${awardsSummary}

Positioning angles: ${student.angles || 'Not specified'}
Profile notes: ${student.traits || 'Not specified'}
${researchContext && researchContext.length > 0 ? `
---

SCHOOL RESEARCH DATA (from official sources + Reddit community — use this to refine admission probability estimates and tailor strategy):
${researchContext.map(r => `
[${r.school_name} — ${r.program}]
• Admission requirements: ${r.admission_requirements}
• Program details: ${r.program_details}
• Career outcomes: ${r.career_outcomes}
• Community insights: ${r.community_insights}
• Application tips: ${r.application_tips.slice(0, 4).join(' | ')}
• Official vs community: ${r.official_vs_community}
`).join('\n')}` : ''}
---

After completing all analysis steps internally, output this exact JSON schema:

{
  "positioning": {
    "type": "string — precise archetype label derived from spike + major alignment",
    "identity": "string — 2–3 sentences: core identity, what makes this applicant distinctive, calibrated to actual profile strength",
    "strengths": ["string", "string", "string", "string"],
    "weaknesses": ["string", "string", "string"]
  },
  "competitiveness": {
    "top10": {
      "level": "High|Medium-High|Medium|Medium-Low|Low",
      "note": "string — cite specific Z-score factors and calibrated probability rationale"
    },
    "top20": {
      "level": "High|Medium-High|Medium|Medium-Low|Low",
      "note": "string"
    },
    "top50": {
      "level": "Very High|High|Medium-High|Medium",
      "note": "string"
    },
    "bullets": [
      "string — portfolio-level insight with P(at least one acceptance) logic",
      "string — specific probability driver or risk",
      "string — actionable takeaway"
    ]
  },
  "schools": {
    "reach": [
      {
        "name": "string — real school name",
        "chance": "X%",
        "note": "string — cite Z-score factors: academic fit, spike alignment, selectivity pressure, calibration applied"
      }
    ],
    "match": [
      {
        "name": "string",
        "chance": "X%",
        "note": "string"
      }
    ],
    "safety": [
      {
        "name": "string",
        "chance": "X%",
        "note": "string"
      }
    ]
  },
  "strategy": {
    "ed_ea": "string — concrete ED/EA/REA recommendation with probability uplift estimate (e.g. 'ED CMU: +12pp uplift over RD'). Justify using portfolio optimization logic.",
    "narrative": "string — 3–4 sentences on essay angle and positioning. Tie to the identified spike and alignment score. Name the specific story to tell."
  },
  "plan": [
    { "month": "May 2026", "tasks": "string — specific, prioritized tasks" },
    { "month": "Jun 2026", "tasks": "string" },
    { "month": "Jul 2026", "tasks": "string" },
    { "month": "Aug 2026", "tasks": "string" },
    { "month": "Sep 2026", "tasks": "string" },
    { "month": "Oct 2026", "tasks": "string" },
    { "month": "Nov 2026", "tasks": "string" },
    { "month": "Dec 2026 – Jan 2027", "tasks": "string" }
  ],
  "meta": {
    "overall_success_probability": "XX%",
    "assessment": "string — 1–2 sentences on portfolio aggressiveness and balance",
    "improvement_levers": [
      "Action → +X% impact at [school tier]",
      "Action → +X% impact",
      "Action → +X% impact"
    ]
  }
}

Rules:
- Reach: 2–4 schools with calibrated P% (use acceptance rate calibration from the model)
- Match: 3–5 schools
- Safety: 2–3 schools
- Use real school names (MIT, Stanford, CMU, Harvard, Yale, Princeton, Duke, Rice, Cornell, Berkeley, Georgia Tech, UCLA, UMich, UIUC, UT Austin Turing, etc.)
- P% must reflect the logistic model with calibration — do not pad probabilities
- No "well-rounded student", no guaranteed admissions language
- CRITICAL: All JSON string values must be on a single line — no literal newlines or tabs inside strings`;
}
