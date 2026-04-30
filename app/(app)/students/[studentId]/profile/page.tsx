'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, GripVertical, Trash2, Plus, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Field } from '@/components/shared/Field';
import { Counter } from '@/components/shared/Counter';
import { ChipGroup } from '@/components/shared/ChipGroup';
import { SaveIndicator } from '@/components/shared/SaveIndicator';
import { COMMON_APP_CATEGORIES } from '@/lib/data';
import { CHAR_LIMITS } from '@/lib/characterLimits';
import type { Student, Activity, Award } from '@/types';

const STEPS = [
  { id: 1, label: 'Basic Info' },
  { id: 2, label: 'Academic' },
  { id: 3, label: 'Activities & Awards' },
  { id: 4, label: 'Goals & Context' },
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
});

const blankAward = (): Award => ({
  id: Math.random().toString(36).slice(2),
  title: '',
  grade: 11,
  level: 'School',
});

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done = s.id < currentStep;
        const active = s.id === currentStep;
        return (
          <div key={s.id} className="flex items-center">
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
              <div className={`h-px w-16 mx-2 mb-6 ${done ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'}`} />
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
  const { students, saveStudent, saveState, triggerSave } = useApp();
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave on data change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => triggerSave(), 600);
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
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const handleSave = () => {
    const student: Student = {
      id: isNew ? `s${Date.now()}` : studentId,
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
      status: existingStudent?.status ?? 'Draft',
      updated: 'Just now',
      activities: data.activities ?? [],
      awards: data.awards ?? [],
    };
    saveStudent(student);
    router.push(`/students/${student.id}/strategy`);
  };

  const handleDraft = () => {
    const student: Student = {
      id: isNew ? `s${Date.now()}` : studentId,
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
      status: 'Draft',
      updated: 'Just now',
      activities: data.activities ?? [],
      awards: data.awards ?? [],
    };
    saveStudent(student);
    router.push('/dashboard');
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
          <p className="text-[var(--muted)] mt-1">Complete each step. Inputs autosave as you go.</p>
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
            <Field label="GPA" error={errors.gpa}>
              <input className={`${inp} ${errors.gpa ? inpErr : ''}`} type="number" step="0.01" min="0" max="5" value={data.gpa ?? ''} onChange={e => update({ gpa: e.target.value })} placeholder="e.g. 4.62" />
            </Field>
            <Field label="GPA type">
              <select className={inp} value={data.gpaType} onChange={e => update({ gpaType: e.target.value as 'Weighted' | 'Unweighted' })}>
                <option value="Weighted">Weighted</option>
                <option value="Unweighted">Unweighted</option>
              </select>
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
                    index={i}
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
                    key={award.id}
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

        {step === 4 && (
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
            <Field label="Academic strengths" optional>
              <input className={inp} value={(data.strengths ?? []).join(', ')} onChange={e => update({ strengths: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Mathematics, Computer Science, Physics" />
            </Field>
            <Field label="Unique positioning angles / narrative hooks" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.angles ?? ''} onChange={e => update({ angles: e.target.value })} placeholder="Published research, startup, nonprofit, unusual background…" />
            </Field>
            <Field label="Personality traits / profile notes" optional>
              <textarea className={`${inp} resize-none`} rows={3} value={data.traits ?? ''} onChange={e => update({ traits: e.target.value })} placeholder="Intellectual curiosity markers, depth signals…" />
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
            {step < 4 ? 'Next' : 'Submit & Continue'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ act, index, onChange, onRemove, inp }: {
  act: Activity;
  index: number;
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
