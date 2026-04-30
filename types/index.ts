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
}

export interface SchoolEntry {
  name: string;
  chance: string;
  note: string;
}

export interface Strategy {
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
  accept: number;
  sat: number;
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
