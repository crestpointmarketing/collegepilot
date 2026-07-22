/**
 * Essay Guide — data contracts (E1/E2).
 *
 * The guide NEVER writes essays. It does three things: mines evidence-backed
 * angles, maps each school's actual prompts + traits, and critiques student
 * drafts. Every AI-generated angle is a working_hypothesis; every school fact
 * it leans on carries a verification status — same honesty rules as the
 * Blueprint.
 */

export const PROMPT_TYPES = [
  'why_school', 'why_major', 'community', 'identity',
  'intellectual_vitality', 'activity', 'challenge', 'short_answer', 'other',
] as const;
export type PromptType = (typeof PROMPT_TYPES)[number];

export const PROMPT_TYPE_META: Record<PromptType, { label: string }> = {
  why_school:            { label: 'Why school' },
  why_major:             { label: 'Why major' },
  community:             { label: 'Community' },
  identity:              { label: 'Identity' },
  intellectual_vitality: { label: 'Intellectual vitality' },
  activity:              { label: 'Activity' },
  challenge:             { label: 'Challenge' },
  short_answer:          { label: 'Short answer' },
  other:                 { label: 'Other' },
};

export interface EssayPrompt {
  id: string;
  schoolId: string;
  /** e.g. "2025-26". Prompts age out — the UI must show the cycle. */
  admissionCycle: string;
  applicationRound?: 'ED' | 'EA' | 'REA' | 'RD' | 'ALL';
  /** Program-specific prompt (e.g. an engineering-college supplement). */
  programId?: string;
  promptText: string;
  wordLimit?: number;
  promptType: PromptType;
  sourceUrl?: string;
  sourceType: 'official' | 'common_app' | 'verified_secondary' | 'user_added';
  verifiedAt?: string;
  /** current = verified for the active cycle; needs_verification = check before drafting. */
  status: 'current' | 'needs_verification' | 'expired';
}

/* ── Workflow ── */
export const WORKFLOW_STATUS_ORDER = [
  'not_started', 'exploring_angles', 'angle_selected',
  'drafting', 'ready_for_review', 'needs_revision', 'final',
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUS_ORDER)[number];

export const WORKFLOW_META: Record<WorkflowStatus, { label: string; tone: 'neutral' | 'accent' | 'positive' | 'warning' | 'critical' | 'info' }> = {
  not_started:      { label: 'Not Started',      tone: 'neutral' },
  exploring_angles: { label: 'Exploring Angles', tone: 'info' },
  angle_selected:   { label: 'Angle Selected',   tone: 'accent' },
  drafting:         { label: 'Drafting',         tone: 'accent' },
  ready_for_review: { label: 'Ready for Review', tone: 'warning' },
  needs_revision:   { label: 'Needs Revision',   tone: 'warning' },
  final:            { label: 'Final',            tone: 'positive' },
};

/* ── Angle card (E2 output) — a direction to test, never prose ── */
export interface EssayAngle {
  /** One-line core angle, e.g. "The failed first SpeakWise corpus as a lesson in listening". */
  angle: string;
  /** Names of REAL profile items (activities/projects/awards) this angle uses. */
  personalEvidence: string[];
  /** What school/program trait it answers, with an honesty note on how verified that trait is. */
  schoolHook: string;
  /** verified = grounded in schoolFacts; unverified = student must confirm on the official page. */
  schoolHookStatus: 'verified' | 'unverified';
  /** How this angle expresses the Blueprint master line / confirmed identity. */
  masterLineLink: string;
  /** Overlap risk with the Common App essay or sibling supplementals. */
  repetitionRisk: string;
  clicheRisk: string;
  /** Questions the student must answer before this angle can carry an essay. */
  openQuestions: string[];
  /** Always working_hypothesis — the student validates, the AI never decides. */
  status: 'working_hypothesis';
}

export type AngleDisposition = 'proposed' | 'saved' | 'rejected' | 'selected';

/* ── DB row shapes (snake_case mirrors the tables) ── */
export interface EssayProjectRow {
  id: string;
  student_id: string;
  school_id: string;
  program: string | null;
  prompt_id: string | null;
  custom_prompt: { promptText: string; wordLimit?: number; promptType?: PromptType } | null;
  selected_angle_id: string | null;
  workflow_status: WorkflowStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface EssayAngleRow {
  id: string;
  project_id: string;
  data: EssayAngle;
  disposition: AngleDisposition;
  created_at: string;
}
