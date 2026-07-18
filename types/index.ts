export type CourseYear = 'Pre-9' | 9 | 10 | 11 | 12;

export interface Course {
  id: string;
  name: string;
  level: 'AP' | 'IB' | 'Honors' | 'Dual Enrollment' | 'Regular';
  gradeSem1: string;   // letter or numeric: "A", "A-", "95"
  gradeSem2: string;
  year: CourseYear;
  apScore?: number;    // 1–5 AP exam score, not the course grade
  schoolYear?: string;
  credit?: number;
  transcriptCode?: string;
  subjectArea?: string;
  notes?: string;
}

export type ProjectLinkType = 'github' | 'video' | 'paper' | 'website' | 'other';

/** Verifiable artifact attached to a project — the anchor an AO could actually check. */
export interface ProjectLink {
  type: ProjectLinkType;
  url: string;
  label?: string;
}

export interface Project {
  id: string;
  name: string;
  field: string;       // "CS", "Biology", "Economics", etc.
  type: 'Research' | 'Independent' | 'Product' | 'Startup';
  description: string;
  outcome: string;     // "Published paper", "GitHub 2k stars", "Patent filed"
  affiliation?: string; // "MIT PRIMES", "Stanford OHS", "Independent"
  impact?: string;
  period?: string;
  links?: ProjectLink[];
}

export interface Activity {
  id: string;
  category: string;
  position: string;
  org: string;
  desc: string;
  grades: number[];
  timing: string;
  hours: number | string;
  weeks: number | string;
  period?: string;
}

export interface Award {
  id: string;
  title: string;
  grade: number;
  level: 'National' | 'State' | 'Regional' | 'School' | string;
}

export type StudentStatus = 'Draft' | 'Strategy Generated' | 'Document Ready' | 'Needs Review';

export interface Student {
  id: string;
  name: string;
  grade: number;
  school: string;
  city: string;
  major: string;
  secondary: string;
  gpa: string;
  gpaType: 'Weighted' | 'Unweighted';
  sat: string;
  act: string;
  apCount: number;
  strengths: string[];
  weak: string[];
  citizenship: string;
  schoolType: 'Public' | 'Private';
  competitiveness: string;
  firstGen: 'Yes' | 'No';
  targetRange: 'Top 10' | 'Top 20' | 'Top 50';
  risk: 'Conservative' | 'Balanced' | 'Aggressive';
  preferred: string;
  traits: string;
  angles: string;
  color: string;
  status: StudentStatus;
  updated: string;
  activities: Activity[];
  awards: Award[];
  // Extended academic profile (optional — improves strategy accuracy)
  gpaUnweighted?: string;
  schoolAvgSat?: number;
  classRank?: string;
  classSize?: number;
  gpaScale?: number;
  apIbOffered?: number;
  satMath?: number;
  satReadingWriting?: number;
  satSuperscore?: 'Yes' | 'No' | 'Unknown';
  testOptionalPlan?: 'Submit Scores' | 'Test Optional' | 'Undecided';
  plannedRetake?: string;
  englishTest?: string;
  seniorCourses?: string;
  academicTrend?: string;
  graduationProgram?: string;
  endorsements?: string[];
  stateAssessments?: string[];
  performanceAcknowledgements?: string[];
  transcriptRevision?: string;
  sampleProfileRevision?: string;
  courses?: Course[];
  projects?: Project[];
  // Online presence (optional — verifiable anchors for the assessment layer)
  websiteUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  // Application context and preferences (optional — never infer sensitive data)
  residencyStatus?: string;
  stateResidency?: string;
  needBasedAid?: 'Yes' | 'No' | 'Unsure';
  meritAidPriority?: 'High' | 'Medium' | 'Low';
  annualBudget?: string;
  parentEducation?: string;
  familyResponsibilities?: string;
  personalStatementIdeas?: string;
  backgroundContext?: string;
  challengesContext?: string;
  additionalInformation?: string;
  whyMajorEvidence?: string;
  recommenderPlan?: string;
  /** Structured picks from the school database (max 20). Falls back to name-matching `preferred` when absent. */
  preferredSchoolIds?: string[];
  /** Acceptability test: schools the student would NOT actually attend if admitted (a "safety" here is not a real safety). */
  notAttendIds?: string[];
  /** The school (id) the student plans to apply ED/binding-early to, if decided. */
  edChoiceId?: string;
  /** Timeline task completion, keyed by derived task id. Stored with the student — no separate table needed. */
  timelineChecks?: Record<string, boolean>;
  preferredRegions?: string[];
  excludedRegions?: string[];
  preferredSettings?: string[];
  preferredSchoolSizes?: string[];
  schoolMustHaves?: string;
  schoolAvoids?: string;
}

export interface SchoolEntry {
  name: string;
  chance: string;
  note: string;
}

export interface StrategyLever {
  action: string;
  dimension: string;
  deadline: string;
  expected_effect: string;
  /** Artifact that proves completion (mentor letter, public repo, score report…). */
  evidence_required?: string;
  /** Application material this action feeds (activities list, Why Major essay…). */
  material_served?: string;
  rationale: string;
}

/** A single execution-plan task with a generation-time stable id (content hash). */
export interface PlanTask {
  id: string;
  month: string;
  text: string;
  material: string;
}

/**
 * V2 payload: full audit trail from the deterministic admissions engine.
 * Shapes come straight from lib/admissions (type-only imports) so the stored
 * payload can never silently drift from what the engine produces.
 */
export interface StrategyV2 {
  version: 2;
  generatedAt: string;
  /** Admission cycle the school data describes, e.g. "2025-26". */
  dataCycle?: string;
  /** Rules-engine version that produced these numbers. */
  engineVersion?: string;
  assessment: import('@/lib/admissions/assessment').ProfileAssessment;
  evaluations: import('@/lib/admissions/engine').SchoolEvaluation[];
  /** Engine-proposed additions to patch coverage gaps — not on the student's own list. */
  suggestions?: import('@/lib/admissions/engine').SchoolEvaluation[];
  portfolio: import('@/lib/admissions/engine').PortfolioSummary;
  levers: StrategyLever[];
  /** Stable-id task list derived from `plan` at generation time. */
  planTasks?: PlanTask[];
}

export interface Strategy {
  analysis?: {
    spike_assessment: string;
    academic_rigor: string;
    profile_read: string;
    key_risks: string;
  };
  positioning: {
    type: string;
    identity: string;
    strengths: string[];
    weaknesses: string[];
  };
  competitiveness: {
    top10: { level: string; note: string };
    top20: { level: string; note: string };
    top50: { level: string; note: string };
    bullets: string[];
  };
  schools: {
    reach: SchoolEntry[];
    match: SchoolEntry[];
    safety: SchoolEntry[];
  };
  strategy: {
    ed_ea: string;
    narrative: string;
  };
  plan: Array<{ month: string; tasks: string }>;
  meta?: {
    overall_success_probability: string;
    assessment: string;
    improvement_levers: string[];
  };
  v2?: StrategyV2;
}

export interface School {
  id: string;
  name: string;
  short: string;
  city: string;
  state: string;
  region: 'West' | 'East' | 'Midwest' | 'South';
  type: 'Public' | 'Private';
  size: 'Small' | 'Medium' | 'Large';
  setting: 'Urban' | 'Suburban' | 'Rural';
  accept: number;       // overall admit rate (source: Common Data Set)
  csAccept?: number;    // CS/engineering program-specific admit rate where available
  sat: number;          // median SAT composite (50th pct, source: Common Data Set)
  gpa: number;
  ranking: number;
  majors: string[];
  topRanked: boolean;
  vibe: string[];
  why: string;
  angle: string;
  // Extended detail fields
  culture?: string;
  highlights?: string[];
  admissionTips?: string[];
  financialAid?: string;
  edDeadline?: string;
  eaDeadline?: string;
  rdDeadline?: string;
  notableAlumni?: string[];
  careerOutcomes?: string;
}

export interface Tweaks {
  nav: 'top' | 'sidebar';
  density: 'comfortable' | 'compact';
  cardStyle: 'bordered' | 'shadow';
  accent: 'blue' | 'indigo' | 'slate' | 'emerald';
}
