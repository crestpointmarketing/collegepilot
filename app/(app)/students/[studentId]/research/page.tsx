'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Search, BookOpen, TrendingUp, Users, Lightbulb, AlertTriangle, ExternalLink, CheckCircle, X, ChevronDown, RefreshCw, Target, Microscope } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { IntelligenceCenter } from '@/components/intelligence/IntelligenceCenter';

interface ProgramOption {
  name: string;
  category: string;
  department?: string;
  source_url?: string;
  source_title?: string;
  confidence?: 'High' | 'Medium' | 'Low';
  source: 'local' | 'cache' | 'firecrawl';
}

interface ResearchResult {
  school: string;
  program: string;
  admission_requirements: string;
  program_details: string;
  career_outcomes: string;
  community_insights: string;
  application_tips: string[];
  official_vs_community: string;
  summary?: {
    admissions?: string;
    program?: string;
    outcomes?: string;
    student_view?: string;
  };
  structured_research?: StructuredResearch;
  confidence: 'High' | 'Medium' | 'Low';
  sources: Array<{ title: string; url: string; type: string }>;
  generated_at: string;
}

type StructuredSectionData = Record<string, string>;

interface StructuredResearch {
  requirements?: StructuredSectionData;
  program_details?: StructuredSectionData;
  outcomes?: StructuredSectionData;
  community?: StructuredSectionData;
  official_vs_community?: StructuredSectionData;
}

const REQUIREMENT_FIELDS = [
  ['gpa', 'GPA'],
  ['sat_act', 'SAT / ACT'],
  ['selectivity', 'Selectivity'],
  ['coursework', 'Coursework'],
  ['portfolio_interview', 'Portfolio / Interview'],
  ['deadlines', 'Deadlines'],
  ['notes', 'Notes'],
];

const PROGRAM_FIELDS = [
  ['curriculum', 'Curriculum'],
  ['tracks', 'Tracks / Concentrations'],
  ['research', 'Research Access'],
  ['class_size', 'Class Size'],
  ['special_features', 'Special Features'],
];

const OUTCOME_FIELDS = [
  ['starting_salary', 'Starting Salary'],
  ['employers', 'Top Employers'],
  ['internships', 'Internships'],
  ['grad_school', 'Graduate School'],
  ['career_paths', 'Career Paths'],
];

const COMMUNITY_FIELDS = [
  ['student_sentiment', 'Student Sentiment'],
  ['strengths', 'Strengths'],
  ['complaints', 'Common Complaints'],
  ['culture_fit', 'Culture Fit'],
  ['reddit_notes', 'Reddit / Forum Notes'],
];

const OFFICIAL_FIELDS = [
  ['alignment', 'Where Sources Align'],
  ['gaps', 'Potential Gaps'],
  ['confidence_notes', 'Confidence Notes'],
];

const DEGREE_OPTIONS = [
  'Undergraduate',
  'Bachelor\'s',
  'Honors Program',
  'Certificate',
  'Minor',
  'Graduate',
];

const SCHOOL_DEPARTMENT_OPTIONS: Record<string, string[]> = {
  utaustin: [
    'Department of Computer Science',
    'Department of Statistics and Data Sciences',
    'Department of Mathematics',
    'Department of Biology',
    'College of Natural Sciences',
    'Department of Electrical and Computer Engineering',
    'Department of Aerospace Engineering and Engineering Mechanics',
    'Department of Biomedical Engineering',
    'Department of Chemical Engineering',
    'Department of Mechanical Engineering',
    'Cockrell School of Engineering',
    'McCombs School of Business',
    'College of Liberal Arts',
    'School of Information',
    'School of Architecture',
    'Moody College of Communication',
    'College of Fine Arts',
  ],
  berkeley: [
    'College of Letters & Science',
    'College of Engineering',
    'Haas School of Business',
    'College of Computing, Data Science, and Society',
    'College of Chemistry',
    'College of Environmental Design',
  ],
};

const SCHOOL_PROGRAM_OPTIONS: Record<string, ProgramOption[]> = {
  utaustin: [
    { name: 'Computer Science', category: 'Major', department: 'Department of Computer Science', source: 'local' },
    { name: 'Turing Scholars Honors Program', category: 'Honors Program', department: 'Department of Computer Science', source: 'local' },
    { name: 'Data Science', category: 'Major', department: 'Department of Statistics and Data Sciences', source: 'local' },
    { name: 'Mathematics', category: 'Major', department: 'Department of Mathematics', source: 'local' },
    { name: 'Statistics and Data Science', category: 'Major', department: 'Department of Statistics and Data Sciences', source: 'local' },
    { name: 'Biology', category: 'Major', department: 'Department of Biology', source: 'local' },
    { name: 'Aerospace Engineering', category: 'Major', department: 'Department of Aerospace Engineering and Engineering Mechanics', source: 'local' },
    { name: 'Biomedical Engineering', category: 'Major', department: 'Department of Biomedical Engineering', source: 'local' },
    { name: 'Chemical Engineering', category: 'Major', department: 'Department of Chemical Engineering', source: 'local' },
    { name: 'Electrical and Computer Engineering', category: 'Major', department: 'Department of Electrical and Computer Engineering', source: 'local' },
    { name: 'Mechanical Engineering', category: 'Major', department: 'Department of Mechanical Engineering', source: 'local' },
    { name: 'Business', category: 'Major', department: 'McCombs School of Business', source: 'local' },
    { name: 'Business Honors Program', category: 'Honors Program', department: 'McCombs School of Business', source: 'local' },
    { name: 'Accounting', category: 'Major', department: 'McCombs School of Business', source: 'local' },
    { name: 'Finance', category: 'Major', department: 'McCombs School of Business', source: 'local' },
    { name: 'Marketing', category: 'Major', department: 'McCombs School of Business', source: 'local' },
    { name: 'Economics', category: 'Major', department: 'College of Liberal Arts', source: 'local' },
    { name: 'Government', category: 'Major', department: 'College of Liberal Arts', source: 'local' },
    { name: 'Psychology', category: 'Major', department: 'College of Liberal Arts', source: 'local' },
    { name: 'English', category: 'Major', department: 'College of Liberal Arts', source: 'local' },
    { name: 'History', category: 'Major', department: 'College of Liberal Arts', source: 'local' },
    { name: 'Plan II Honors', category: 'Honors Program', department: 'College of Liberal Arts', source: 'local' },
    { name: 'Informatics', category: 'Major', department: 'School of Information', source: 'local' },
    { name: 'Architecture', category: 'Major', department: 'School of Architecture', source: 'local' },
    { name: 'Advertising', category: 'Major', department: 'Moody College of Communication', source: 'local' },
    { name: 'Communication Studies', category: 'Major', department: 'Moody College of Communication', source: 'local' },
  ],
};

const LOADING_STEPS = [
  'Searching official sources…',
  'Scanning Reddit discussions…',
  'Synthesizing with AI…',
];

const CONFIDENCE_COLOR = {
  High: 'text-green-700 bg-green-50',
  Medium: 'text-amber-700 bg-amber-50',
  Low: 'text-red-700 bg-red-50',
};

function mergeProgramOptions(options: ProgramOption[]) {
  const seen = new Set<string>();
  return options.filter(option => {
    const key = option.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getProgramSourceLabel(option: ProgramOption) {
  if (option.source === 'local') return 'Local';
  if (option.source === 'cache') return 'Cached';
  return 'Latest';
}

function isUsefulProgramOptionName(name: string) {
  const lower = name.trim().toLowerCase();
  if (!lower || lower.length < 3) return false;
  const exactNoise = new Set([
    'undergraduate degrees',
    'graduate degrees',
    'law degrees',
    'medical degrees',
    'degree',
    'degrees',
  ]);
  const containsNoise = [
    'chatting',
    'students ',
    'student ',
    'studying',
    'two students',
    'undergraduate degrees',
    'graduate degrees',
    'law degrees',
  ];
  if (exactNoise.has(lower)) return false;
  return !containsNoise.some(term => lower.includes(term));
}

function cleanText(value: unknown): string {
  if (Array.isArray(value)) return value.map(item => cleanText(item)).filter(Boolean).join('\n');
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\\n/g, '\n')
    .replace(/…/g, '...')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/’/g, "'")
    .replace(/“|â€/g, '"')
    .replace(/\*\*/g, '')
    .replace(/\[[0-9]+\]/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitFormattedText(value: unknown): string[] {
  const text = cleanText(value);
  if (!text) return [];
  return text
    .split(/\n+|(?<=\.)\s+(?=(?:[A-Z][A-Za-z /&-]+:|[0-9]+\.|- ))|(?<=;)\s+/g)
    .map((part: string) => part.trim())
    .filter(Boolean);
}

function getLeadText(value: unknown, fallback: string) {
  const first = splitFormattedText(value)[0] ?? cleanText(value);
  if (!first) return fallback;
  const normalized = first.replace(/^[-•]\s*/, '').replace(/^[0-9]+[.)]\s*/, '');
  return normalized.length > 150 ? `${normalized.slice(0, 147).trim()}...` : normalized;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FormattedText({ value }: { value: unknown }) {
  const parts = splitFormattedText(value);
  if (parts.length === 0) {
    return <p className="text-[13.5px] text-[var(--muted)]">No details returned.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part: string, index: number) => {
        const normalized = part.replace(/^[-•]\s*/, '').replace(/^[0-9]+[.)]\s*/, '');
        const labelMatch = normalized.match(/^([^:]{2,44}):\s*(.+)$/);

        if (labelMatch) {
          return (
            <div key={`${normalized}-${index}`} className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
              <span className="font-semibold text-[var(--ink)]">{labelMatch[1]}: </span>
              <span>{labelMatch[2]}</span>
            </div>
          );
        }

        if (/^[-•]|\d+[.)]\s/.test(part)) {
          return (
            <div key={`${normalized}-${index}`} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent)] shrink-0" />
              <span>{normalized}</span>
            </div>
          );
        }

        return (
          <p key={`${normalized}-${index}`} className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
            {normalized}
          </p>
        );
      })}
    </div>
  );
}

function cleanRecord(value: unknown): StructuredSectionData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, fieldValue]) => [key, cleanText(fieldValue)])
  );
}

function FieldGrid({
  fields,
  data,
  fallback,
}: {
  fields: string[][];
  data?: StructuredSectionData;
  fallback: unknown;
}) {
  const fallbackParts = splitFormattedText(fallback);
  const fallbackText = fallbackParts.length ? fallbackParts.join(' ') : cleanText(fallback);

  return (
    <div className="grid grid-cols-1 gap-2.5">
      {fields.map(([key, label], index) => {
        const value = cleanText(data?.[key]) || (index === fields.length - 1 ? fallbackText : '');
        return (
          <div key={key} className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
              {label}
            </div>
            <p className={`text-[13.5px] leading-relaxed ${value ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
              {value || 'Not found'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function KeyTakeaways({ result }: { result: ResearchResult }) {
  const items = [
    {
      label: 'Admissions',
      value: cleanText(result.summary?.admissions) || getLeadText(result.structured_research?.requirements?.selectivity || result.admission_requirements, 'Review official requirements and program selectivity.'),
    },
    {
      label: 'Program',
      value: cleanText(result.summary?.program) || getLeadText(result.structured_research?.program_details?.special_features || result.program_details, 'Confirm curriculum, tracks, and research fit.'),
    },
    {
      label: 'Outcomes',
      value: cleanText(result.summary?.outcomes) || getLeadText(result.structured_research?.outcomes?.career_paths || result.career_outcomes, 'Check internship, employer, and salary outcomes.'),
    },
    {
      label: 'Student View',
      value: cleanText(result.summary?.student_view) || getLeadText(result.structured_research?.community?.student_sentiment || result.community_insights, 'Compare official claims with student experience.'),
    },
  ];

  return (
    <div className="bg-white border border-[var(--line)] rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--ink)]">Key Takeaways</h3>
          <p className="text-[12px] text-[var(--muted)] mt-0.5">Fast scan before reading the detailed research.</p>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${CONFIDENCE_COLOR[result.confidence]}`}>
          {result.confidence}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label} className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">
              {item.label}
            </div>
            <p className="text-[13.5px] leading-relaxed text-[var(--ink)]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeResearchResult(data: Record<string, unknown>): ResearchResult {
  const tipsValue = data.application_tips;
  const structured = data.structured_research && typeof data.structured_research === 'object'
    ? data.structured_research as Record<string, unknown>
    : {};
  const tips = Array.isArray(tipsValue)
    ? tipsValue.map((tip: unknown) => cleanText(tip)).filter(Boolean)
    : splitFormattedText(tipsValue).map(tip => tip.replace(/^[-•]\s*/, '').replace(/^[0-9]+[.)]\s*/, ''));

  return {
    school: cleanText(data.school),
    program: cleanText(data.program),
    admission_requirements: cleanText(data.admission_requirements),
    program_details: cleanText(data.program_details),
    career_outcomes: cleanText(data.career_outcomes),
    community_insights: cleanText(data.community_insights),
    application_tips: tips.length ? tips : ['Review the official program page before finalizing this strategy.'],
    official_vs_community: cleanText(data.official_vs_community),
    summary: data.summary && typeof data.summary === 'object'
      ? cleanRecord(data.summary)
      : undefined,
    structured_research: {
      requirements: cleanRecord(structured.requirements),
      program_details: cleanRecord(structured.program_details),
      outcomes: cleanRecord(structured.outcomes),
      community: cleanRecord(structured.community),
      official_vs_community: cleanRecord(structured.official_vs_community),
    },
    confidence: data.confidence === 'Low' || data.confidence === 'Medium' || data.confidence === 'High' ? data.confidence : 'Medium',
    sources: Array.isArray(data.sources) ? data.sources as ResearchResult['sources'] : [],
    generated_at: cleanText(data.generated_at) || new Date().toISOString(),
  };
}

function normalizeProgramError(message: string) {
  if (message.includes('401') || message.includes('authentication_error') || message.includes('invalid x-api-key')) {
    return 'Firecrawl authentication failed. Copy the full Firecrawl API key into FIRECRAWL_API_KEY, then restart/redeploy.';
  }
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--line)] rounded-xl p-5 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--accent)]">{icon}</span>
        <span className="text-[12px] font-semibold uppercase tracking-widest text-[var(--ink-soft)]">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function ResearchPage() {
  const { schools, students, strategies } = useApp();
  const params = useParams();
  const studentId = params.studentId as string;
  const activeStudent = students.find(s => s.id === studentId) ?? null;
  const v2 = strategies[studentId]?.v2 ?? null;
  const [tab, setTab] = useState<'match' | 'deep'>('match');
  // '' = user hasn't chosen; fall back to the first school on the student's list.
  const [matchSchoolChoice, setMatchSchoolChoice] = useState<string>('');
  const matchSchoolId = matchSchoolChoice || (v2?.evaluations?.[0]?.schoolId ?? '');
  const setMatchSchoolId = setMatchSchoolChoice;
  const matchSchool = schools.find(s => s.id === matchSchoolId) ?? null;
  const [schoolInput, setSchoolInput] = useState('');
  const [degreeInput, setDegreeInput] = useState('Undergraduate');
  const [departmentInput, setDepartmentInput] = useState('');
  const [programInput, setProgramInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [cached, setCached] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDepartmentSuggestions, setShowDepartmentSuggestions] = useState(false);
  const [showProgramSuggestions, setShowProgramSuggestions] = useState(false);
  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState('');
  const programRequestRef = useRef(0);

  const matchedSchool = schools.find(s =>
    s.name.toLowerCase() === schoolInput.trim().toLowerCase() ||
    s.short.toLowerCase() === schoolInput.trim().toLowerCase()
  );

  const schoolDepartmentOptions = matchedSchool ? (SCHOOL_DEPARTMENT_OPTIONS[matchedSchool.id] ?? []) : [];
  const schoolDepartmentSet = new Set(schoolDepartmentOptions.map(option => option.toLowerCase()));
  const localProgramOptions: ProgramOption[] = matchedSchool
    ? (SCHOOL_PROGRAM_OPTIONS[matchedSchool.id] ?? matchedSchool.majors.map(name => ({
        name,
        category: 'Major',
        source: 'local' as const,
      })))
    : [];

  const allProgramOptions = mergeProgramOptions([...localProgramOptions, ...programOptions])
    .filter(option => isUsefulProgramOptionName(option.name))
    .filter(option => !schoolDepartmentSet.has(option.name.trim().toLowerCase()))
    .filter(option => !option.name.includes('http') && !option.name.includes('[') && !option.name.includes(']'));
  const programDepartmentOptions = allProgramOptions
    .map(option => option.department?.trim())
    .filter((department): department is string => Boolean(department));
  const departmentOptions = Array.from(new Set(
    [...schoolDepartmentOptions, ...programDepartmentOptions]
  )).slice(0, 12);
  const filteredDepartmentOptions = showDepartmentSuggestions
    ? departmentOptions
        .filter(option => option.toLowerCase().includes(departmentInput.trim().toLowerCase()))
        .slice(0, 10)
    : [];
  const filteredProgramOptions = showProgramSuggestions
    ? allProgramOptions
        .filter(option => {
          const programMatch = option.name.toLowerCase().includes(programInput.trim().toLowerCase());
          const departmentMatch = !departmentInput.trim() ||
            option.department?.toLowerCase().includes(departmentInput.trim().toLowerCase());
          const degreeMatch = degreeInput === 'Undergraduate' ||
            option.category.toLowerCase().includes(degreeInput.toLowerCase().replace("'s", '')) ||
            option.name.toLowerCase().includes(degreeInput.toLowerCase().replace("'s", ''));
          return programMatch && departmentMatch && degreeMatch;
        })
        .slice(0, 12)
    : [];

  const loadCachedPrograms = async (schoolName: string, quiet = false) => {
    const trimmed = schoolName.trim();
    if (!trimmed) return;
    const requestId = ++programRequestRef.current;
    setProgramsLoading(true);
    if (!quiet) setProgramsError('');
    try {
      const res = await fetch(`/api/programs?school=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to load programs');
      if (requestId === programRequestRef.current) {
        setProgramOptions((data.programs ?? []).map((program: ProgramOption) => ({
          ...program,
          source: 'cache',
        })));
      }
    } catch (err) {
      if (!quiet && requestId === programRequestRef.current) {
        setProgramsError(err instanceof Error ? err.message : 'Failed to load programs');
      }
    } finally {
      if (requestId === programRequestRef.current) setProgramsLoading(false);
    }
  };

  const refreshPrograms = async () => {
    const trimmed = schoolInput.trim();
    if (!trimmed) return;
    const requestId = ++programRequestRef.current;
    setProgramsLoading(true);
    setProgramsError('');
    setShowProgramSuggestions(true);
    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school: trimmed, force: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to fetch latest programs');
      if (requestId === programRequestRef.current) {
        setProgramOptions((data.programs ?? []).map((program: ProgramOption) => ({
          ...program,
          source: data.cached ? 'cache' : 'firecrawl',
        })));
      }
    } catch (err) {
      if (requestId === programRequestRef.current) {
        setProgramsError(normalizeProgramError(err instanceof Error ? err.message : 'Failed to fetch latest programs'));
      }
    } finally {
      if (requestId === programRequestRef.current) setProgramsLoading(false);
    }
  };

  const selectSchool = (name: string) => {
    setSchoolInput(name);
    setProgramInput('');
    setDepartmentInput('');
    setDegreeInput('Undergraduate');
    setProgramOptions([]);
    setSaved(false);
    setShowSuggestions(false);
    setShowDepartmentSuggestions(false);
    setShowProgramSuggestions(false);
    void loadCachedPrograms(name, true);
  };

  const clearSchool = () => {
    programRequestRef.current += 1;
    setSchoolInput('');
    setDegreeInput('Undergraduate');
    setDepartmentInput('');
    setProgramInput('');
    setProgramOptions([]);
    setSaved(false);
    setShowSuggestions(false);
    setShowDepartmentSuggestions(false);
    setShowProgramSuggestions(false);
  };

  const clearDepartment = () => {
    setDepartmentInput('');
    setSaved(false);
    setShowDepartmentSuggestions(false);
    setShowProgramSuggestions(false);
  };

  const clearProgram = () => {
    setProgramInput('');
    setSaved(false);
    setShowProgramSuggestions(false);
  };

  const selectDepartment = (name: string) => {
    setDepartmentInput(name);
    setSaved(false);
    setShowDepartmentSuggestions(false);
    setShowProgramSuggestions(true);
  };

  const selectProgram = (optionOrName: ProgramOption | string) => {
    const option = typeof optionOrName === 'string' ? null : optionOrName;
    const name = typeof optionOrName === 'string' ? optionOrName : optionOrName.name;
    setProgramInput(name);
    if (option?.department) setDepartmentInput(option.department);
    if (option?.category && option.category !== 'Major') setDegreeInput(option.category);
    setSaved(false);
    setShowProgramSuggestions(false);
  };

  const researchProgramLabel = [
    degreeInput.trim(),
    departmentInput.trim(),
    programInput.trim(),
  ].filter(Boolean).join(' / ');

  const handleResearch = async (force = false) => {
    if (!schoolInput.trim() || !programInput.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSaved(false);
    setCached(false);

    // Animate loading steps
    setLoadingStep(0);
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 4000);

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school: schoolInput.trim(), program: researchProgramLabel, force }),
      });
      const text = await res.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); }
      catch { throw new Error(res.ok ? 'Invalid response from server' : `Server error ${res.status}`); }
      if (!res.ok || data.error) throw new Error(String(data.detail ?? data.error ?? 'Research failed'));
      setResult(normalizeResearchResult(data));
      setCached(Boolean(data.cached));
      setSaved(Boolean(data.cached) || data.saved !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  // Suggestions from existing schools
  const suggestions = showSuggestions
    ? schools
        .filter(s => !schoolInput.trim() || s.name.toLowerCase().includes(schoolInput.toLowerCase()))
        .slice(0, schoolInput.trim() ? 5 : 8)
    : [];

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[28px] font-bold text-[var(--ink)] tracking-tight mb-1">Admission Intelligence</h1>
        <p className="text-[14px] text-[var(--ink-soft)]">
          {activeStudent ? `Why each school fits ${activeStudent.name}, how to apply, and live school research` : 'School fit, application strategy, and live research'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--line)]">
        {([['match', 'Match & Strategy', Target], ['deep', 'Deep Research', Microscope]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Match & Strategy tab ── */}
      {tab === 'match' && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <label className="text-[12px] font-semibold text-[var(--ink)] uppercase tracking-wide">School</label>
            <select
              value={matchSchoolId}
              onChange={e => setMatchSchoolId(e.target.value)}
              className="px-3 py-2 text-[13.5px] border border-[var(--line-strong)] rounded-lg bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">Select a school…</option>
              {v2?.evaluations?.length ? (
                <optgroup label="On this student's list">
                  {v2.evaluations.map(e => <option key={e.schoolId} value={e.schoolId}>{e.short}</option>)}
                </optgroup>
              ) : null}
              <optgroup label="All schools">
                {schools.map(s => <option key={s.id} value={s.id}>{s.short}</option>)}
              </optgroup>
            </select>
            {matchSchool && <span className="text-[12px] text-[var(--muted)]">{matchSchool.name} · #{matchSchool.ranking}</span>}
          </div>
          {!activeStudent ? (
            <div className="bg-white border border-[var(--line)] rounded-xl p-10 text-center text-[13px] text-[var(--muted)]">Student not found.</div>
          ) : !matchSchool ? (
            <div className="bg-white border border-[var(--line)] rounded-xl p-10 text-center text-[13px] text-[var(--muted)]">Pick a school to see the fit and application analysis.</div>
          ) : (
            <IntelligenceCenter key={matchSchool.id} student={activeStudent} school={matchSchool} v2={v2} studentId={studentId} />
          )}
        </div>
      )}

      {tab === 'deep' && (
      <>
      {/* Input Form */}
      <div className="bg-white border border-[var(--line)] rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">School</label>
            <input
              type="text"
              value={schoolInput}
              onChange={e => {
                setSchoolInput(e.target.value);
                setProgramOptions([]);
                setSaved(false);
                setShowSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. UT Austin, MIT, Stanford"
              className="w-full px-3 py-2.5 pr-9 text-[13.5px] border border-[var(--line-strong)] rounded-lg bg-white text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-100)]"
            />
            {schoolInput && (
              <button
                type="button"
                onClick={clearSchool}
                className="absolute right-2 top-[34px] p-1 rounded-md text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
                aria-label="Clear school"
              >
                <X size={14} />
              </button>
            )}
            {!schoolInput && (
              <button
                type="button"
                onClick={() => setShowSuggestions(true)}
                className="absolute right-2 top-[34px] p-1 rounded-md text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
                aria-label="Show school options"
              >
                <ChevronDown size={15} />
              </button>
            )}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--line)] rounded-lg shadow-card z-10 overflow-hidden">
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectSchool(s.name)}
                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--bg-soft)] text-[var(--ink)]"
                  >
                    {s.name}
                    <span className="text-[11px] text-[var(--muted)] ml-2">{s.city}, {s.state}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">Degree</label>
            <select
              value={degreeInput}
              onChange={e => {
                setDegreeInput(e.target.value);
                setSaved(false);
                setShowProgramSuggestions(true);
              }}
              className="w-full px-3 py-2.5 pr-9 text-[13.5px] border border-[var(--line-strong)] rounded-lg bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-100)]"
            >
              {DEGREE_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {degreeInput !== 'Undergraduate' && (
              <button
                type="button"
                onClick={() => {
                  setDegreeInput('Undergraduate');
                  setSaved(false);
                }}
                className="absolute right-8 top-[34px] p-1 rounded-md text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
                aria-label="Reset degree"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative">
            <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">Department / College</label>
            <input
              type="text"
              value={departmentInput}
              onFocus={() => {
                setShowDepartmentSuggestions(true);
                setShowProgramSuggestions(false);
                if (schoolInput.trim() && programOptions.length === 0) void loadCachedPrograms(schoolInput, true);
              }}
              onBlur={() => setTimeout(() => setShowDepartmentSuggestions(false), 150)}
              onChange={e => {
                setDepartmentInput(e.target.value);
                setSaved(false);
                setShowDepartmentSuggestions(true);
                setShowProgramSuggestions(false);
              }}
              placeholder="e.g. Cockrell, McCombs, Natural Sciences"
              className="w-full px-3 py-2.5 pr-9 text-[13.5px] border border-[var(--line-strong)] rounded-lg bg-white text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-100)]"
            />
            {departmentInput && (
              <button
                type="button"
                onClick={clearDepartment}
                className="absolute right-2 top-[34px] p-1 rounded-md text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
                aria-label="Clear department"
              >
                <X size={14} />
              </button>
            )}
            {!departmentInput && (
              <button
                type="button"
                onClick={() => {
                  setShowDepartmentSuggestions(true);
                  setShowProgramSuggestions(false);
                  if (schoolInput.trim() && programOptions.length === 0) void loadCachedPrograms(schoolInput, true);
                }}
                className="absolute right-2 top-[34px] p-1 rounded-md text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
                aria-label="Show department options"
              >
                <ChevronDown size={15} />
              </button>
            )}
            {showDepartmentSuggestions && (filteredDepartmentOptions.length > 0 || departmentInput.trim()) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--line)] rounded-lg shadow-card z-20 overflow-hidden max-h-[260px] overflow-y-auto">
                {filteredDepartmentOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => selectDepartment(option)}
                    className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-soft)] text-[var(--ink)]"
                  >
                    <span className="text-[13px] font-medium">{option}</span>
                  </button>
                ))}
                {departmentInput.trim() && !filteredDepartmentOptions.some(option => option.toLowerCase() === departmentInput.trim().toLowerCase()) && (
                  <button
                    onClick={() => selectDepartment(departmentInput.trim())}
                    className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-soft)] text-[13px] text-[var(--ink)] border-t border-[var(--line)]"
                  >
                    Use &quot;{departmentInput.trim()}&quot; as custom department
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">Major / Program</label>
            <input
              type="text"
              value={programInput}
              onFocus={() => {
                setShowProgramSuggestions(true);
                if (schoolInput.trim() && programOptions.length === 0) void loadCachedPrograms(schoolInput, true);
              }}
              onBlur={() => setTimeout(() => setShowProgramSuggestions(false), 150)}
              onChange={e => {
                setProgramInput(e.target.value);
                setSaved(false);
                setShowProgramSuggestions(true);
              }}
              placeholder="e.g. Turing Scholars, CS, Bioengineering"
              className="w-full px-3 py-2.5 pr-9 text-[13.5px] border border-[var(--line-strong)] rounded-lg bg-white text-[var(--ink)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-100)]"
            />
            {programInput && (
              <button
                type="button"
                onClick={clearProgram}
                className="absolute right-2 top-[34px] p-1 rounded-md text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
                aria-label="Clear major"
              >
                <X size={14} />
              </button>
            )}
            {!programInput && (
              <button
                type="button"
                onClick={() => {
                  setShowProgramSuggestions(true);
                  if (schoolInput.trim() && programOptions.length === 0) void loadCachedPrograms(schoolInput, true);
                }}
                className="absolute right-2 top-[34px] p-1 rounded-md text-[var(--muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]"
                aria-label="Show major options"
              >
                <ChevronDown size={15} />
              </button>
            )}
            {showProgramSuggestions && (filteredProgramOptions.length > 0 || programInput.trim()) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--line)] rounded-lg shadow-card z-20 overflow-hidden max-h-[300px] overflow-y-auto">
                {filteredProgramOptions.map(option => (
                  <button
                    key={`${option.source}-${option.name}`}
                    onClick={() => selectProgram(option)}
                    className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-soft)] text-[var(--ink)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium">{option.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)] shrink-0">
                        {getProgramSourceLabel(option)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                      <span>{option.category}</span>
                      {option.department && <span>{option.department}</span>}
                      {option.confidence && <span>{option.confidence}</span>}
                    </div>
                  </button>
                ))}
                {programInput.trim() && !filteredProgramOptions.some(option => option.name.toLowerCase() === programInput.trim().toLowerCase()) && (
                  <button
                    onClick={() => selectProgram(programInput.trim())}
                    className="w-full text-left px-3 py-2.5 hover:bg-[var(--bg-soft)] text-[13px] text-[var(--ink)] border-t border-[var(--line)]"
                  >
                    Use &quot;{programInput.trim()}&quot; as custom program
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => handleResearch()}
          disabled={loading || !schoolInput.trim() || !programInput.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white text-[13.5px] font-semibold rounded-lg hover:bg-[var(--accent-600)] disabled:opacity-50 transition-colors"
        >
          <Search size={14} />
          {loading ? 'Researching…' : 'Run Research'}
        </button>
        <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={refreshPrograms}
          disabled={programsLoading || loading || !schoolInput.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--line-strong)] text-[var(--ink)] text-[13px] font-semibold rounded-lg hover:bg-[var(--bg-soft)] disabled:opacity-50 transition-colors"
        >
          <BookOpen size={14} />
          {programsLoading ? 'Refreshing programs...' : 'Fetch Latest Programs'}
        </button>
        {programsError && (
          <span className="text-[12.5px] text-red-700 max-w-[460px] whitespace-normal break-words">
            {programsError}
          </span>
        )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-[var(--line)] rounded-xl p-8 mb-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            <div className="flex flex-col gap-2 w-full max-w-[320px]">
              {LOADING_STEPS.map((step, i) => (
                <div key={step} className={`flex items-center gap-2.5 text-[13px] transition-all ${i <= loadingStep ? 'text-[var(--ink)]' : 'text-[var(--muted-2)]'}`}>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                    i < loadingStep ? 'bg-green-100' : i === loadingStep ? 'bg-[var(--accent-50)]' : 'bg-[var(--line)]'
                  }`}>
                    {i < loadingStep
                      ? <CheckCircle size={10} className="text-green-600" />
                      : <div className={`w-1.5 h-1.5 rounded-full ${i === loadingStep ? 'bg-[var(--accent)]' : 'bg-[var(--muted-2)]'}`} />
                    }
                  </div>
                  {step}
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[var(--muted)] mt-2">Deep research takes 15–30 seconds</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[var(--red-50)] border border-red-200 rounded-xl p-4 mb-6 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Meta bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-bold text-[var(--ink)]">{result.school} — {result.program}</h2>
              {result.confidence && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CONFIDENCE_COLOR[result.confidence]}`}>
                  {result.confidence} Confidence
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {cached && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-soft)] text-[var(--muted)] border border-[var(--line)]">
                  Cached
                </span>
              )}
              <span className="text-[11px] text-[var(--muted)]">
                {new Date(result.generated_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <KeyTakeaways result={result} />

          {/* Research sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Section icon={<BookOpen size={14} />} title="Admission Requirements">
              <FieldGrid
                fields={REQUIREMENT_FIELDS}
                data={result.structured_research?.requirements}
                fallback={result.admission_requirements}
              />
            </Section>

            <Section icon={<TrendingUp size={14} />} title="Career Outcomes">
              <FieldGrid
                fields={OUTCOME_FIELDS}
                data={result.structured_research?.outcomes}
                fallback={result.career_outcomes}
              />
            </Section>
          </div>

          <Section icon={<BookOpen size={14} />} title="Program Details">
            <FieldGrid
              fields={PROGRAM_FIELDS}
              data={result.structured_research?.program_details}
              fallback={result.program_details}
            />
          </Section>

          <Section icon={<Users size={14} />} title="Community Insights (Reddit)">
            <FieldGrid
              fields={COMMUNITY_FIELDS}
              data={result.structured_research?.community}
              fallback={result.community_insights}
            />
          </Section>

          <Section icon={<Lightbulb size={14} />} title="Application Tips">
            <ul className="grid grid-cols-1 gap-2.5">
              {result.application_tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] p-3 text-[13.5px] text-[var(--ink-soft)]">
                  <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{cleanText(tip)}</span>
                </li>
              ))}
            </ul>
          </Section>

          {result.official_vs_community && result.official_vs_community !== 'Sources align' && (
            <Section icon={<AlertTriangle size={14} />} title="Official vs Community">
              <FieldGrid
                fields={OFFICIAL_FIELDS}
                data={result.structured_research?.official_vs_community}
                fallback={result.official_vs_community}
              />
            </Section>
          )}

          {/* Sources */}
          <div className="bg-[var(--bg-soft)] rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2.5">Sources ({result.sources.length})</p>
            <div className="flex flex-col gap-1.5">
              {result.sources.slice(0, 8).map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[12.5px] text-[var(--accent)] hover:underline"
                >
                  <ExternalLink size={11} className="shrink-0" />
                  <span className="truncate">{s.title || s.url}</span>
                  {s.type === 'reddit' && (
                    <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded shrink-0">Reddit</span>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-4 pt-2 pb-8">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-green-700">
                <CheckCircle size={14} />
                Saved to research library — available to strategy generation and the AI advisor
              </span>
            )}
            {cached && (
              <button
                onClick={() => handleResearch(true)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[var(--line-strong)] text-[var(--ink)] text-[12.5px] font-semibold rounded-lg hover:bg-[var(--bg-soft)] disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} />
                Re-run Fresh Research
              </button>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
