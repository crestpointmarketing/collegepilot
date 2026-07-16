'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, GripVertical, Trash2, Plus, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Field } from '@/components/shared/Field';
import { Counter } from '@/components/shared/Counter';
import { ChipGroup } from '@/components/shared/ChipGroup';
import { SaveIndicator } from '@/components/shared/SaveIndicator';
import { COMMON_APP_CATEGORIES } from '@/lib/data';
import { CHAR_LIMITS } from '@/lib/characterLimits';
import type { Student, Activity, Award, Course, CourseYear, Project } from '@/types';

type TranscriptSort = 'grade' | 'subject';

const STEPS = [
  { id: 1, label: 'Basic Info' },
  { id: 2, label: 'Academic' },
  { id: 3, label: 'Transcript' },
  { id: 4, label: 'Activities' },
  { id: 5, label: 'Context' },
  { id: 6, label: 'Story' },
  { id: 7, label: 'Goals' },
];

const blankActivity = (): Activity => ({
  id: Math.random().toString(36).slice(2),
  category: '',
  position: '',
  org: '',
  desc: '',
  grades: [],
  timing: 'School Year',
  hours: '',
  weeks: '',
  period: '',
});

const blankAward = (): Award => ({
  id: Math.random().toString(36).slice(2),
  title: '',
  grade: 11,
  level: 'School',
});

const GPA_MAX: Record<Course['level'], number> = {
  'AP': 5.0,
  'IB': 5.0,
  'Dual Enrollment': 5.0,
  'Honors': 4.5,
  'Regular': 4.0,
};

function subjectRank(name: string) {
  const lower = name.toLowerCase();
  if (/english|language arts/.test(lower)) return 1;
  if (/latin|chinese|spanish|french|german/.test(lower)) return 2;
  if (/algebra|geometry|calculus|precal|statistics|math/.test(lower)) return 3;
  if (/biology|chemistry|physics|science/.test(lower)) return 4;
  if (/history|geography|government|economics|social/.test(lower)) return 5;
  if (/computer|technology|coding|programming/.test(lower)) return 6;
  if (/art|music|fine/.test(lower)) return 7;
  if (/health|fitness|pe|physical/.test(lower)) return 8;
  return 99;
}

const blankCourse = (): Course => ({
  id: Math.random().toString(36).slice(2),
  name: '',
  level: 'AP',
  gradeSem1: '',
  gradeSem2: '',
  year: 11,
});

function courseYearRank(year: CourseYear) {
  return year === 'Pre-9' ? 8 : year;
}

const blankProject = (): Project => ({
  id: Math.random().toString(36).slice(2),
  name: '',
  field: '',
  type: 'Research',
  description: '',
  outcome: '',
  affiliation: '',
  impact: '',
  period: '',
});

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = s.id < currentStep;
        const active = s.id === currentStep;
        return (
          <div key={s.id} className="flex shrink-0 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all ${
                  done
                    ? 'bg-[var(--accent)] text-white'
                    : active
                    ? 'bg-white text-[var(--accent)] border-2 border-[var(--accent)] shadow-focus'
                    : 'bg-[var(--line)] text-[var(--muted)]'
                }`}
              >
                {done ? <Check size={14} strokeWidth={3} /> : s.id}
              </div>
              <div className={`text-[12px] mt-1.5 font-medium ${active ? 'text-[var(--accent)]' : done ? 'text-[var(--ink-soft)]' : 'text-[var(--muted)]'}`}>
                {s.label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 mx-1.5 mb-6 ${done ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { students, saveStudent, saveStudentDraft, saveState } = useApp();
  const studentId = params.studentId as string;
  const isNew = studentId === 'new';

  const existingStudent = isNew ? null : students.find(s => s.id === studentId) ?? null;

  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<Student>>(() => ({
    name: '', grade: 11, school: '', city: '',
    gpa: '', gpaType: 'Weighted', sat: '', act: '', apCount: 0,
    major: '', secondary: '',
    strengths: [], weak: [],
    activities: [blankActivity()],
    awards: [blankAward()],
    targetRange: 'Top 20', risk: 'Balanced', preferred: '',
    citizenship: '', schoolType: 'Public', competitiveness: 'Top', firstGen: 'No',
    traits: '', angles: '',
    ...(existingStudent ?? {}),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [transcriptSort, setTranscriptSort] = useState<TranscriptSort>('grade');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable id for the whole editing session so autosave and final save hit the same row.
  // For a new student the id is minted lazily at first save (never during render).
  const draftIdRef = useRef<string | null>(isNew ? null : studentId);
  const getDraftId = () => {
    if (draftIdRef.current === null) draftIdRef.current = `s${Date.now()}`;
    return draftIdRef.current;
  };
  const skippedInitialAutosave = useRef(false);
  const sortedCourses = (data.courses ?? [])
    .map((course, index) => ({ course, index }))
    .sort((a, b) => {
      if (transcriptSort === 'subject') {
        return subjectRank(a.course.name) - subjectRank(b.course.name)
          || a.course.name.localeCompare(b.course.name)
          || courseYearRank(a.course.year) - courseYearRank(b.course.year);
      }
      return courseYearRank(a.course.year) - courseYearRank(b.course.year)
        || subjectRank(a.course.name) - subjectRank(b.course.name)
        || a.course.name.localeCompare(b.course.name);
    });

  const buildStudent = (status: Student['status']): Student => ({
    id: getDraftId(),
    name: data.name ?? '',
    grade: data.grade ?? 11,
    school: data.school ?? '',
    city: data.city ?? '',
    major: data.major ?? '',
    secondary: data.secondary ?? '',
    gpa: data.gpa ?? '',
    gpaType: data.gpaType ?? 'Weighted',
    sat: data.sat ?? '',
    act: data.act ?? '',
    apCount: data.apCount ?? 0,
    strengths: data.strengths ?? [],
    weak: data.weak ?? [],
    citizenship: data.citizenship ?? '',
    schoolType: data.schoolType ?? 'Public',
    competitiveness: data.competitiveness ?? 'Top',
    firstGen: data.firstGen ?? 'No',
    targetRange: data.targetRange ?? 'Top 20',
    risk: data.risk ?? 'Balanced',
    preferred: data.preferred ?? '',
    traits: data.traits ?? '',
    angles: data.angles ?? '',
    color: existingStudent?.color ?? '#6366f1',
    status,
    updated: 'Just now',
    activities: data.activities ?? [],
    awards: data.awards ?? [],
    gpaUnweighted: data.gpaUnweighted,
    schoolAvgSat: data.schoolAvgSat,
    classRank: data.classRank,
    classSize: data.classSize,
    gpaScale: data.gpaScale,
    apIbOffered: data.apIbOffered,
    satMath: data.satMath,
    satReadingWriting: data.satReadingWriting,
    satSuperscore: data.satSuperscore,
    testOptionalPlan: data.testOptionalPlan,
    plannedRetake: data.plannedRetake,
    englishTest: data.englishTest,
    seniorCourses: data.seniorCourses,
    academicTrend: data.academicTrend,
    graduationProgram: data.graduationProgram,
    endorsements: data.endorsements ?? [],
    stateAssessments: data.stateAssessments ?? [],
    performanceAcknowledgements: data.performanceAcknowledgements ?? [],
    transcriptRevision: data.transcriptRevision,
    courses: data.courses ?? [],
    projects: data.projects ?? [],
    residencyStatus: data.residencyStatus,
    stateResidency: data.stateResidency,
    needBasedAid: data.needBasedAid,
    meritAidPriority: data.meritAidPriority,
    annualBudget: data.annualBudget,
    parentEducation: data.parentEducation,
    familyResponsibilities: data.familyResponsibilities,
    personalStatementIdeas: data.personalStatementIdeas,
    backgroundContext: data.backgroundContext,
    challengesContext: data.challengesContext,
    additionalInformation: data.additionalInformation,
    whyMajorEvidence: data.whyMajorEvidence,
    recommenderPlan: data.recommenderPlan,
    preferredRegions: data.preferredRegions ?? [],
    excludedRegions: data.excludedRegions ?? [],
    preferredSettings: data.preferredSettings ?? [],
    preferredSchoolSizes: data.preferredSchoolSizes ?? [],
    schoolMustHaves: data.schoolMustHaves,
    schoolAvoids: data.schoolAvoids,
  });

  // Autosave on data change — persists edits to existing students without
  // discarding their strategy. New students are only created on an explicit save.
  useEffect(() => {
    if (isNew || !existingStudent) return;
    if (!skippedInitialAutosave.current) {
      skippedInitialAutosave.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveStudentDraft(buildStudent(existingStudent.status));
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<Student>) => setData(prev => ({ ...prev, ...patch }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!data.name?.trim()) e.name = 'Required';
      if (!data.school?.trim()) e.school = 'Required';
    }
    if (step === 2) {
      if (!data.gpa) e.gpa = 'Required';
      if (!data.major?.trim()) e.major = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    if (step < STEPS.length) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const student = buildStudent('Draft');
    // Wait for the write to land so strategy generation reads the fresh profile
    const ok = await saveStudent(student);
    if (ok) router.push(`/students/${student.id}/strategy`);
  };

  const handleDraft = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const ok = await saveStudent(buildStudent('Draft'));
    if (ok) router.push('/dashboard');
  };

  const inp = 'w-full px-3 py-2 rounded border border-[var(--line-strong)] text-[13.5px] bg-white focus:outline-none focus:border-[var(--accent)] focus:shadow-focus transition-all';
  const inpErr = 'border-red-400 focus:border-red-500 focus:shadow-none';

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">
            {existingStudent ? 'Edit Student Profile' : 'Create Student Profile'}
          </h1>
          <p className="text-[var(--muted)] mt-1">Complete each step, then save a draft or continue to strategy.</p>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />
          <button
            onClick={() => router.push('/dashboard')}
            className="px-3 py-2 rounded text-[13.5px] font-medium text-[var(--ink-soft)] hover:bg-[var(--bg-soft)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <Stepper currentStep={step} />

      <div className="bg-white rounded-card shadow-card p-6 mb-6 animate-slide-in" key={step}>
        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Full name" error={errors.name}>
                <input className={`${inp} ${errors.name ? inpErr : ''}`} value={data.name ?? ''} onChange={e => update({ name: e.target.value })} placeholder="e.g. Aarav Patel" />
              </Field>
            </div>
            <Field label="Grade">
              <select className={inp} value={data.grade} onChange={e => update({ grade: parseInt(e.target.value) })}>
                {[9, 10, 11, 12].map(g => <option key={g} value={g}>{g}th grade</option>)}
              </select>
            </Field>
            <Field label="School type">
              <select className={inp} value={data.schoolType} onChange={e => update({ schoolType: e.target.value as 'Public' | 'Private' })}>
                <option>Public</option>
                <option>Private</option>
              </select>
            </Field>
            <Field label="High school" error={errors.school}>
              <input className={`${inp} ${errors.school ? inpErr : ''}`} value={data.school ?? ''} onChange={e => update({ school: e.target.value })} placeholder="e.g. Mission San Jose High School" />
            </Field>
            <Field label="City, State" optional>
              <input className={inp} value={data.city ?? ''} onChange={e => update({ city: e.target.value })} placeholder="e.g. Fremont, CA" />
            </Field>
            <Field label="Citizenship" optional>
              <input className={inp} value={data.citizenship ?? ''} onChange={e => update({ citizenship: e.target.value })} placeholder="e.g. U.S. Citizen" />
            </Field>
            <Field label="First-generation college student">
              <select className={inp} value={data.firstGen} onChange={e => update({ firstGen: e.target.value as 'Yes' | 'No' })}>
                <option>No</option>
                <option>Yes</option>
              </select>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="GPA (weighted)" error={errors.gpa}>
              <input className={`${inp} ${errors.gpa ? inpErr : ''}`} type="number" step="0.01" min="0" max="5" value={data.gpa ?? ''} onChange={e => update({ gpa: e.target.value })} placeholder="e.g. 4.62" />
            </Field>
            <Field label="GPA (unweighted)" optional>
              <input className={inp} type="number" step="0.01" min="0" max="4" value={data.gpaUnweighted ?? ''} onChange={e => update({ gpaUnweighted: e.target.value })} placeholder="e.g. 3.97" />
            </Field>
            <Field label="SAT score" optional>
              <input className={inp} type="number" min="400" max="1600" value={data.sat ?? ''} onChange={e => update({ sat: e.target.value })} placeholder="e.g. 1560" />
            </Field>
            <Field label="ACT score" optional>
              <input className={inp} type="number" min="1" max="36" value={data.act ?? ''} onChange={e => update({ act: e.target.value })} placeholder="e.g. 35" />
            </Field>
            <Field label="AP / IB courses completed">
              <input className={inp} type="number" min="0" max="20" value={data.apCount ?? 0} onChange={e => update({ apCount: parseInt(e.target.value) || 0 })} />
            </Field>
            <Field label="School avg SAT" optional hint="Used for context adjustment in AI evaluation">
              <input className={inp} type="number" min="800" max="1600" value={data.schoolAvgSat ?? ''} onChange={e => update({ schoolAvgSat: parseInt(e.target.value) || undefined })} placeholder="e.g. 1180" />
            </Field>
            <Field label="Class rank" optional hint="Enter DNR if the school does not rank">
              <input className={inp} value={data.classRank ?? ''} onChange={e => update({ classRank: e.target.value })} placeholder="e.g. 12 / 520 or DNR" />
            </Field>
            <Field label="Class size" optional>
              <input className={inp} type="number" min="1" value={data.classSize ?? ''} onChange={e => update({ classSize: parseInt(e.target.value) || undefined })} placeholder="e.g. 520" />
            </Field>
            <Field label="Weighted GPA scale" optional>
              <input className={inp} type="number" min="4" max="100" step="0.1" value={data.gpaScale ?? ''} onChange={e => update({ gpaScale: parseFloat(e.target.value) || undefined })} placeholder="e.g. 5.0" />
            </Field>
            <Field label="AP / IB courses offered" optional hint="Helps judge rigor in school context">
              <input className={inp} type="number" min="0" value={data.apIbOffered ?? ''} onChange={e => update({ apIbOffered: parseInt(e.target.value) || undefined })} placeholder="e.g. 24" />
            </Field>
            <Field label="SAT Math" optional>
              <input className={inp} type="number" min="200" max="800" value={data.satMath ?? ''} onChange={e => update({ satMath: parseInt(e.target.value) || undefined })} placeholder="e.g. 790" />
            </Field>
            <Field label="SAT Reading & Writing" optional>
              <input className={inp} type="number" min="200" max="800" value={data.satReadingWriting ?? ''} onChange={e => update({ satReadingWriting: parseInt(e.target.value) || undefined })} placeholder="e.g. 750" />
            </Field>
            <Field label="SAT superscore" optional>
              <select className={inp} value={data.satSuperscore ?? 'Unknown'} onChange={e => update({ satSuperscore: e.target.value as Student['satSuperscore'] })}>
                <option>Unknown</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </Field>
            <Field label="Score submission plan" optional>
              <select className={inp} value={data.testOptionalPlan ?? 'Undecided'} onChange={e => update({ testOptionalPlan: e.target.value as Student['testOptionalPlan'] })}>
                <option>Undecided</option>
                <option>Submit Scores</option>
                <option>Test Optional</option>
              </select>
            </Field>
            <Field label="Planned retake" optional>
              <input className={inp} value={data.plannedRetake ?? ''} onChange={e => update({ plannedRetake: e.target.value })} placeholder="e.g. SAT October 2026" />
            </Field>
            <Field label="English proficiency test" optional>
              <input className={inp} value={data.englishTest ?? ''} onChange={e => update({ englishTest: e.target.value })} placeholder="e.g. TOEFL 112 / Not required" />
            </Field>
            <div className="col-span-2">
              <Field label="Intended major" error={errors.major}>
                <input className={`${inp} ${errors.major ? inpErr : ''}`} value={data.major ?? ''} onChange={e => update({ major: e.target.value })} placeholder="e.g. Computer Science" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Secondary major / interest" optional>
                <input className={inp} value={data.secondary ?? ''} onChange={e => update({ secondary: e.target.value })} placeholder="e.g. Mathematics" />
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6">
            {/* Transcript / Courses */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="text-[15px] font-semibold text-[var(--ink)]">Courses / Transcript ({data.courses?.length ?? 0})</div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-[var(--line-strong)] bg-white p-0.5">
                    {(['grade', 'subject'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTranscriptSort(mode)}
                        className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-md transition-colors ${
                          transcriptSort === mode
                            ? 'bg-[var(--accent)] text-white'
                            : 'text-[var(--ink-soft)] hover:bg-[var(--bg-soft)]'
                        }`}
                      >
                        {mode === 'grade' ? 'Grade' : 'Subject'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => update({ courses: [...(data.courses ?? []), blankCourse()] })}
                    className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                  >
                    <Plus size={13} /> Add course
                  </button>
                </div>
              </div>
              <p className="text-[12px] text-[var(--muted)] mb-3">List every credit-bearing course, including courses completed before Grade 9. AP exam scores stay blank unless separately reported.</p>
              {(data.courses ?? []).length === 0 && (
                <div className="text-[13px] text-[var(--muted)] py-4 text-center border border-dashed border-[var(--line)] rounded-lg">
                  No courses added — optional but improves strategy accuracy
                </div>
              )}
              <div className="flex flex-col gap-2">
                {sortedCourses.map(({ course, index }) => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    onChange={updated => {
                      const arr = [...(data.courses ?? [])];
                      arr[index] = updated;
                      update({ courses: arr });
                    }}
                    onRemove={() => update({ courses: (data.courses ?? []).filter((_, j) => j !== index) })}
                    inp={inp}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--line)] pt-5">
              <div className="text-[15px] font-semibold text-[var(--ink)] mb-1">Academic context</div>
              <p className="text-[12px] text-[var(--muted)] mb-3">Capture the context a transcript alone cannot explain.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Graduation program" optional>
                  <input className={inp} value={data.graduationProgram ?? ''} onChange={e => update({ graduationProgram: e.target.value })} placeholder="e.g. Foundation High School Program" />
                </Field>
                <Field label="Endorsements" optional hint="Separate with commas">
                  <input className={inp} value={(data.endorsements ?? []).join(', ')} onChange={e => update({ endorsements: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Multidisciplinary Studies" />
                </Field>
                <div className="col-span-2">
                  <Field label="Senior-year course plan" optional>
                    <textarea className={`${inp} resize-none`} rows={2} value={data.seniorCourses ?? ''} onChange={e => update({ seniorCourses: e.target.value })} placeholder="List planned Grade 12 courses and rigor." />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Academic trend / grading context" optional>
                    <textarea className={`${inp} resize-none`} rows={2} value={data.academicTrend ?? ''} onChange={e => update({ academicTrend: e.target.value })} placeholder="Upward trend, schedule constraints, unusual grading policies…" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="State assessments" optional hint="One item per line">
                    <textarea className={`${inp} resize-none`} rows={3} value={(data.stateAssessments ?? []).join('\n')} onChange={e => update({ stateAssessments: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} placeholder="English I EOC — Masters (Spring 2024)" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Transcript acknowledgements / certifications" optional hint="One item per line">
                    <textarea className={`${inp} resize-none`} rows={4} value={(data.performanceAcknowledgements ?? []).join('\n')} onChange={e => update({ performanceAcknowledgements: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} placeholder="Information Technology Specialist — Python" />
                  </Field>
                </div>
              </div>
            </div>

            {/* Projects & Research */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[15px] font-semibold text-[var(--ink)]">Research & Projects</div>
                <button
                  type="button"
                  onClick={() => update({ projects: [...(data.projects ?? []), blankProject()] })}
                  className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                >
                  <Plus size={13} /> Add project
                </button>
              </div>
              <p className="text-[12px] text-[var(--muted)] mb-3">Academic research, independent projects, products, or startups. Key spike signal for Top 10.</p>
              {(data.projects ?? []).length === 0 && (
                <div className="text-[13px] text-[var(--muted)] py-4 text-center border border-dashed border-[var(--line)] rounded-lg">
                  No projects added — optional
                </div>
              )}
              <div className="flex flex-col gap-3">
                {(data.projects ?? []).map((proj, i) => (
                  <ProjectCard
                    key={proj.id}
                    project={proj}
                    onChange={updated => {
                      const arr = [...(data.projects ?? [])];
                      arr[i] = updated;
                      update({ projects: arr });
                    }}
                    onRemove={() => update({ projects: (data.projects ?? []).filter((_, j) => j !== i) })}
                    inp={inp}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[15px] font-semibold text-[var(--ink)]">Activities ({(data.activities?.length ?? 0)}/10)</div>
                <button
                  type="button"
                  onClick={() => update({ activities: [...(data.activities ?? []), blankActivity()] })}
                  className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                >
                  <Plus size={13} /> Add activity
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {(data.activities ?? []).map((act, i) => (
                  <ActivityCard
                    key={act.id}
                    act={act}
                    onChange={updated => {
                      const arr = [...(data.activities ?? [])];
                      arr[i] = updated;
                      update({ activities: arr });
                    }}
                    onRemove={() => {
                      const arr = (data.activities ?? []).filter((_, j) => j !== i);
                      update({ activities: arr });
                    }}
                    inp={inp}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[15px] font-semibold text-[var(--ink)]">Honors & Awards ({(data.awards?.length ?? 0)}/5)</div>
                <button
                  type="button"
                  onClick={() => update({ awards: [...(data.awards ?? []), blankAward()] })}
                  className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent)] hover:underline"
                >
                  <Plus size={13} /> Add award
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {(data.awards ?? []).map((award, i) => (
                  <AwardCard
                    key={`${award.id}-${i}`}
                    award={award}
                    onChange={updated => {
                      const arr = [...(data.awards ?? [])];
                      arr[i] = updated;
                      update({ awards: arr });
                    }}
                    onRemove={() => {
                      const arr = (data.awards ?? []).filter((_, j) => j !== i);
                      update({ awards: arr });
                    }}
                    inp={inp}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[15px] font-semibold text-[var(--ink)]">Application context</div>
              <p className="text-[12px] text-[var(--muted)] mt-1">Only enter information you are comfortable using in application planning.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Residency / visa status" optional>
                <input className={inp} value={data.residencyStatus ?? ''} onChange={e => update({ residencyStatus: e.target.value })} placeholder="e.g. U.S. citizen, permanent resident, F-1" />
              </Field>
              <Field label="State residency" optional>
                <input className={inp} value={data.stateResidency ?? ''} onChange={e => update({ stateResidency: e.target.value })} placeholder="e.g. Texas resident" />
              </Field>
              <Field label="Need-based aid" optional>
                <select className={inp} value={data.needBasedAid ?? 'Unsure'} onChange={e => update({ needBasedAid: e.target.value as Student['needBasedAid'] })}>
                  <option>Unsure</option><option>Yes</option><option>No</option>
                </select>
              </Field>
              <Field label="Merit aid priority" optional>
                <select className={inp} value={data.meritAidPriority ?? 'Medium'} onChange={e => update({ meritAidPriority: e.target.value as Student['meritAidPriority'] })}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </Field>
              <Field label="Annual family budget" optional hint="A range is enough; do not enter account details">
                <input className={inp} value={data.annualBudget ?? ''} onChange={e => update({ annualBudget: e.target.value })} placeholder="e.g. $30k–$45k per year" />
              </Field>
              <Field label="Parent / guardian education" optional>
                <input className={inp} value={data.parentEducation ?? ''} onChange={e => update({ parentEducation: e.target.value })} placeholder="Useful for first-generation context" />
              </Field>
              <div className="col-span-2">
                <Field label="Family, work, or caregiving responsibilities" optional>
                  <textarea className={`${inp} resize-none`} rows={3} value={data.familyResponsibilities ?? ''} onChange={e => update({ familyResponsibilities: e.target.value })} placeholder="Time commitments or responsibilities that shaped the student's opportunities." />
                </Field>
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-4">
            <Field label="Academic strengths" optional>
              <input className={inp} value={(data.strengths ?? []).join(', ')} onChange={e => update({ strengths: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Mathematics, Computer Science, Physics" />
            </Field>
            <Field label="Known weaknesses / gaps" optional hint="Separate with commas">
              <input className={inp} value={(data.weak ?? []).join(', ')} onChange={e => update({ weak: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Limited humanities depth, activity gap in Grade 10" />
            </Field>
            <Field label="Why-major evidence" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.whyMajorEvidence ?? ''} onChange={e => update({ whyMajorEvidence: e.target.value })} placeholder="Courses, projects, reading, work, or experiences that make the intended major credible." />
            </Field>
            <Field label="Personal statement ideas" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.personalStatementIdeas ?? ''} onChange={e => update({ personalStatementIdeas: e.target.value })} placeholder="Moments, values, tensions, or changes worth exploring." />
            </Field>
            <Field label="Background / identity context" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.backgroundContext ?? ''} onChange={e => update({ backgroundContext: e.target.value })} placeholder="Only include context the student may want reflected in the application." />
            </Field>
            <Field label="Challenges or disruptions" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.challengesContext ?? ''} onChange={e => update({ challengesContext: e.target.value })} placeholder="Health, family, school, access, or other circumstances affecting the record." />
            </Field>
            <Field label="Additional information plan" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.additionalInformation ?? ''} onChange={e => update({ additionalInformation: e.target.value })} placeholder="What needs explanation elsewhere in the application, if anything?" />
            </Field>
            <Field label="Recommendation plan" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.recommenderPlan ?? ''} onChange={e => update({ recommenderPlan: e.target.value })} placeholder="Potential teachers, counselor status, and what each recommender can credibly show." />
            </Field>
            <Field label="Unique positioning angles / narrative hooks" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.angles ?? ''} onChange={e => update({ angles: e.target.value })} placeholder="Published research, startup, nonprofit, unusual background…" />
            </Field>
            <Field label="Personality traits / profile notes" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.traits ?? ''} onChange={e => update({ traits: e.target.value })} placeholder="Intellectual curiosity markers, depth signals…" />
            </Field>
          </div>
        )}

        {step === 7 && (
          <div className="flex flex-col gap-4">
            <Field label="Target school range">
              <ChipGroup
                options={['Top 10', 'Top 20', 'Top 50']}
                value={data.targetRange ?? 'Top 20'}
                onChange={v => update({ targetRange: v as 'Top 10' | 'Top 20' | 'Top 50' })}
                multi={false}
              />
            </Field>
            <Field label="Risk appetite">
              <ChipGroup
                options={['Conservative', 'Balanced', 'Aggressive']}
                value={data.risk ?? 'Balanced'}
                onChange={v => update({ risk: v as 'Conservative' | 'Balanced' | 'Aggressive' })}
                multi={false}
              />
            </Field>
            <Field label="Preferred schools" optional>
              <input className={inp} value={data.preferred ?? ''} onChange={e => update({ preferred: e.target.value })} placeholder="e.g. MIT, Stanford, CMU" />
            </Field>
            <Field label="Preferred regions" optional hint="Separate with commas">
              <input className={inp} value={(data.preferredRegions ?? []).join(', ')} onChange={e => update({ preferredRegions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Northeast, California, Texas" />
            </Field>
            <Field label="Excluded regions" optional hint="Separate with commas">
              <input className={inp} value={(data.excludedRegions ?? []).join(', ')} onChange={e => update({ excludedRegions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Rural Midwest" />
            </Field>
            <Field label="Preferred settings" optional hint="Separate with commas">
              <input className={inp} value={(data.preferredSettings ?? []).join(', ')} onChange={e => update({ preferredSettings: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Urban, Suburban" />
            </Field>
            <Field label="Preferred school sizes" optional hint="Separate with commas">
              <input className={inp} value={(data.preferredSchoolSizes ?? []).join(', ')} onChange={e => update({ preferredSchoolSizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Small, Medium" />
            </Field>
            <Field label="Must-haves" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.schoolMustHaves ?? ''} onChange={e => update({ schoolMustHaves: e.target.value })} placeholder="Programs, affordability, campus culture, research access, location…" />
            </Field>
            <Field label="Deal-breakers / avoids" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.schoolAvoids ?? ''} onChange={e => update({ schoolAvoids: e.target.value })} placeholder="Conditions that should remove a school from the list." />
            </Field>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step === 1 ? router.push('/dashboard') : setStep(step - 1)}
          className="flex items-center gap-1.5 px-4 py-2 rounded border border-[var(--line-strong)] text-[13.5px] font-medium text-[var(--ink-soft)] bg-white hover:bg-[var(--bg-soft)] transition-colors shadow-card"
        >
          <ArrowLeft size={14} />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDraft}
            className="px-4 py-2 rounded text-[13.5px] font-medium text-[var(--ink-soft)] hover:bg-[var(--bg-soft)] transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium"
            style={{ background: 'var(--accent)' }}
          >
            {step < STEPS.length ? 'Next' : 'Submit & Continue'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseRow({ course, onChange, onRemove, inp }: {
  course: Course;
  onChange: (c: Course) => void;
  onRemove: () => void;
  inp: string;
}) {
  const gpaMax = GPA_MAX[course.level];
  return (
    <div className="relative bg-[var(--bg-soft)] rounded-lg p-3 pr-10 border border-[var(--line)] grid grid-cols-12 gap-2 items-end">
      <div className="col-span-2">
        <label className="block text-[11px] text-[var(--muted)] mb-1">Yr</label>
        <select className={`${inp} text-[12px] px-2`} value={String(course.year ?? 11)} onChange={e => {
          const value = e.target.value;
          onChange({ ...course, year: value === 'Pre-9' ? 'Pre-9' : parseInt(value) as CourseYear });
        }}>
          {(['Pre-9', 9, 10, 11, 12] as CourseYear[]).map(y => <option key={y} value={String(y)}>{y === 'Pre-9' ? 'Before 9' : y}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="block text-[11px] text-[var(--muted)] mb-1">
          Level <span className="text-[var(--accent)] font-semibold">/{gpaMax.toFixed(1)}</span>
        </label>
        <select className={`${inp} text-[12px] px-1.5`} value={course.level} onChange={e => {
          const lvl = e.target.value as Course['level'];
          onChange({ ...course, level: lvl, apScore: lvl === 'AP' ? course.apScore : undefined });
        }}>
          {['AP', 'IB', 'Honors', 'Dual Enrollment', 'Regular'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div className="col-span-3">
        <label className="block text-[11px] text-[var(--muted)] mb-1">Course name</label>
        <input className={`${inp} text-[12px]`} value={course.name} onChange={e => onChange({ ...course, name: e.target.value })} placeholder="e.g. AP Calculus BC" />
      </div>
      <div className="col-span-2">
        <label className="block text-[11px] text-[var(--muted)] mb-1">Sem 1</label>
        <input className={`${inp} text-[12px]`} value={course.gradeSem1} onChange={e => onChange({ ...course, gradeSem1: e.target.value })} placeholder="A / 95" />
      </div>
      <div className="col-span-2">
        <label className="block text-[11px] text-[var(--muted)] mb-1">Sem 2</label>
        <input className={`${inp} text-[12px]`} value={course.gradeSem2} onChange={e => onChange({ ...course, gradeSem2: e.target.value })} placeholder="A / 95" />
      </div>
      <div className="col-span-1">
        <label className="block text-[11px] text-[var(--muted)] mb-1">AP</label>
        <select
          className={`${inp} text-[12px] px-1 ${course.level !== 'AP' ? 'opacity-40 bg-[var(--line)] pointer-events-none' : ''}`}
          value={course.level === 'AP' ? (course.apScore ?? '') : ''}
          onChange={e => onChange({ ...course, apScore: e.target.value ? parseInt(e.target.value) : undefined })}
          disabled={course.level !== 'AP'}
        >
          <option value="">—</option>
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {(course.schoolYear || course.transcriptCode || course.credit !== undefined || course.subjectArea || course.notes) && (
        <div className="col-span-12 text-[11px] text-[var(--muted)] flex flex-wrap gap-x-3 gap-y-1 pt-1">
          {course.schoolYear && <span>School year: {course.schoolYear}</span>}
          {course.transcriptCode && <span>Transcript code: {course.transcriptCode}</span>}
          {course.credit !== undefined && <span>Credit: {course.credit.toFixed(2)}</span>}
          {course.subjectArea && <span>Area: {course.subjectArea}</span>}
          {course.notes && <span>{course.notes}</span>}
        </div>
      )}
      <div className="absolute right-2 top-8">
        <button type="button" onClick={onRemove} className="p-1.5 rounded text-[var(--muted-2)] hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project, onChange, onRemove, inp }: {
  project: Project;
  onChange: (p: Project) => void;
  onRemove: () => void;
  inp: string;
}) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  return (
    <div className="bg-[var(--bg-soft)] rounded-card p-4 border border-[var(--line)]">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project name">
          <input className={inp} value={project.name} onChange={e => onChange({ ...project, name: e.target.value })} placeholder="e.g. ML-based Cancer Detection" />
        </Field>
        <Field label="Field">
          <input className={inp} value={project.field} onChange={e => onChange({ ...project, field: e.target.value })} placeholder="e.g. CS, Biology, Economics" />
        </Field>
        <Field label="Type">
          <select className={inp} value={project.type} onChange={e => onChange({ ...project, type: e.target.value as Project['type'] })}>
            {['Research', 'Independent', 'Product', 'Startup'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Period" optional>
          <input className={inp} value={project.period ?? ''} onChange={e => onChange({ ...project, period: e.target.value })} placeholder="e.g. Summer 2026" />
        </Field>
        <div className="col-span-2">
        <Field label="Affiliation" optional>
          <input className={inp} value={project.affiliation ?? ''} onChange={e => onChange({ ...project, affiliation: e.target.value })} placeholder="e.g. MIT PRIMES, Independent" />
        </Field>
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[13px] font-medium text-[var(--ink-soft)]">Description</label>
            <button
              type="button"
              onClick={() => setDescriptionExpanded(prev => !prev)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:underline"
            >
              {descriptionExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {descriptionExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <textarea
            className={`${inp} resize-none transition-[height] duration-200`}
            rows={descriptionExpanded ? 7 : 2}
            value={project.description}
            onChange={e => onChange({ ...project, description: e.target.value })}
            placeholder="What did you build or research? Be specific."
          />
        </div>
        <Field label="Outcome">
          <input className={inp} value={project.outcome} onChange={e => onChange({ ...project, outcome: e.target.value })} placeholder="e.g. Published paper, 2k GitHub stars" />
        </Field>
        <Field label="Impact" optional>
          <input className={inp} value={project.impact ?? ''} onChange={e => onChange({ ...project, impact: e.target.value })} placeholder="e.g. 500 users, $10K revenue" />
        </Field>
      </div>
      <div className="flex justify-end mt-2">
        <button type="button" onClick={onRemove} className="p-1.5 rounded text-[var(--muted-2)] hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ActivityCard({ act, onChange, onRemove, inp }: {
  act: Activity;
  onChange: (a: Activity) => void;
  onRemove: () => void;
  inp: string;
}) {
  return (
    <div className="bg-[var(--bg-soft)] rounded-card p-4 border border-[var(--line)]">
      <div className="flex items-start gap-2 mb-3">
        <div className="mt-2.5 cursor-grab text-[var(--muted-2)]">
          <GripVertical size={16} />
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className={inp} value={act.category} onChange={e => onChange({ ...act, category: e.target.value })}>
              <option value="">Select category…</option>
              {COMMON_APP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field
            label="Position / role"
            counter={<Counter value={act.position} max={CHAR_LIMITS.activityName} />}
          >
            <input
              className={inp}
              maxLength={CHAR_LIMITS.activityName}
              value={act.position}
              onChange={e => onChange({ ...act, position: e.target.value })}
              placeholder="e.g. Founder & Lead Researcher"
            />
          </Field>
          <div className="col-span-2">
            <Field
              label="Organization"
              counter={<Counter value={act.org} max={CHAR_LIMITS.activityOrg} />}
            >
              <input
                className={inp}
                maxLength={CHAR_LIMITS.activityOrg}
                value={act.org}
                onChange={e => onChange({ ...act, org: e.target.value })}
                placeholder="e.g. Riemann ML Lab (independent)"
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field
              label="Description"
              counter={<Counter value={act.desc} max={CHAR_LIMITS.activityDesc} />}
            >
              <textarea
                className={`${inp} resize-none`}
                rows={2}
                maxLength={CHAR_LIMITS.activityDesc}
                value={act.desc}
                onChange={e => onChange({ ...act, desc: e.target.value })}
                placeholder="What did you do? Quantify impact where possible."
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Period" optional>
              <input className={inp} value={act.period ?? ''} onChange={e => onChange({ ...act, period: e.target.value })} placeholder="e.g. Summer 2025–Present" />
            </Field>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <Field label="Participation grades">
              <div className="flex flex-wrap gap-2">
                {[9, 10, 11, 12].map(grade => {
                  const selected = (act.grades ?? []).includes(grade);
                  return (
                    <button
                      key={grade}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange({
                        ...act,
                        grades: selected
                          ? act.grades.filter(value => value !== grade)
                          : [...(act.grades ?? []), grade].sort((a, b) => a - b),
                      })}
                      className={`min-w-9 rounded border px-2.5 py-2 text-[12px] font-semibold transition-colors ${selected ? 'border-[var(--accent)] bg-[var(--accent-50)] text-[var(--accent)]' : 'border-[var(--line-strong)] bg-white text-[var(--ink-soft)]'}`}
                    >
                      {grade}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Participation timing">
              <select className={inp} value={act.timing} onChange={e => onChange({ ...act, timing: e.target.value })}>
                <option>School Year</option>
                <option>School Break</option>
                <option>All Year</option>
                <option>School Year, Summer</option>
              </select>
            </Field>
          </div>
          <Field label="Hrs/week">
            <input className={inp} type="number" min="1" max="40" value={act.hours} onChange={e => onChange({ ...act, hours: e.target.value })} />
          </Field>
          <Field label="Weeks/year">
            <input className={inp} type="number" min="1" max="52" value={act.weeks} onChange={e => onChange({ ...act, weeks: e.target.value })} />
          </Field>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-2 p-1.5 rounded text-[var(--muted-2)] hover:text-red-500 hover:bg-red-50 transition-colors"
          aria-label="Remove activity"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function AwardCard({ award, onChange, onRemove, inp }: {
  award: Award;
  onChange: (a: Award) => void;
  onRemove: () => void;
  inp: string;
}) {
  return (
    <div className="bg-[var(--bg-soft)] rounded-card p-4 border border-[var(--line)] flex items-start gap-3">
      <div className="flex-1 grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field
            label="Award / honor title"
            counter={<Counter value={award.title} max={CHAR_LIMITS.awardName} />}
          >
            <input
              className={inp}
              maxLength={CHAR_LIMITS.awardName}
              value={award.title}
              onChange={e => onChange({ ...award, title: e.target.value })}
              placeholder="e.g. USAMO Qualifier"
            />
          </Field>
        </div>
        <Field label="Grade">
          <select className={inp} value={award.grade} onChange={e => onChange({ ...award, grade: parseInt(e.target.value) })}>
            {[9, 10, 11, 12].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Level">
          <select className={inp} value={award.level} onChange={e => onChange({ ...award, level: e.target.value })}>
            {['School', 'State', 'Regional', 'National', 'International'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="mt-6 p-1.5 rounded text-[var(--muted-2)] hover:text-red-500 hover:bg-red-50 transition-colors"
        aria-label="Remove award"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
