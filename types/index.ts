export interface Course {
  id: string;
  name: string;
  level: 'AP' | 'IB' | 'Honors' | 'Dual Enrollment' | 'Regular';
  grade: string;       // letter or numeric: "A", "A-", "95"
  year: 9 | 10 | 11 | 12;
  apScore?: number;    // 1–5, only for AP courses
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
  courses?: Course[];
  projects?: Project[];
}

export interface SchoolEntry {
  name: string;
  chance: string;
  note: string;
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
