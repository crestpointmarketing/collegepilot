'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Loader2, AlertTriangle, Check, X, BookmarkPlus } from 'lucide-react';
import { DraftReview } from '@/components/essays/DraftReview';
import { fetchStreamedJson } from '@/lib/essays/streamJson';
import { createClient } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { SCHOOLS } from '@/lib/schools';
import { getPrompt } from '@/lib/essays/promptLibrary';
import {
  WORKFLOW_META, PROMPT_TYPE_META,
  type EssayProjectRow, type EssayAngleRow, type AngleDisposition,
} from '@/lib/essays/types';
import { PageHeader, Chip, Card, AlertCard, PrimaryButton, GhostButton, Eyebrow } from '@/components/ui';

type Tab = 'understand' | 'angles' | 'draft';

export default function EssayWorkspacePage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const projectId = params.projectId as string;
  const { students } = useApp();
  const student = students.find(s => s.id === studentId);
  const supabase = useMemo(() => createClient(), []);

  const [project, setProject] = useState<EssayProjectRow | null>(null);
  const [angles, setAngles] = useState<EssayAngleRow[]>([]);
  const [tab, setTab] = useState<Tab>('understand');
  const [err, setErr] = useState<string | null>(null);
  const [mining, setMining] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: proj, error: e1 }, { data: ang }] = await Promise.all([
      supabase.from('essay_projects').select('*').eq('id', projectId).maybeSingle(),
      supabase.from('essay_angles').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
    ]);
    if (e1) { setErr(e1.message); return; }
    setProject((proj as EssayProjectRow) ?? null);
    setAngles(((ang ?? []) as EssayAngleRow[]).filter(a => a.disposition !== 'rejected'));
  }, [supabase, projectId]);

  // Async fetch-on-mount: every setState happens after an await, never synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;
  if (!project) {
    return (
      <div className="animate-fade-in max-w-[1080px] mx-auto">
        {err ? <AlertCard tone="critical" title="Could not load" body={err} /> : <p className="text-[var(--muted)]">Loading…</p>}
      </div>
    );
  }

  const school = SCHOOLS.find(s => s.id === project.school_id);
  const lib = project.prompt_id ? getPrompt(project.prompt_id) : undefined;
  const promptText = lib?.promptText ?? project.custom_prompt?.promptText ?? '';
  const wordLimit = lib?.wordLimit ?? project.custom_prompt?.wordLimit;
  const meta = WORKFLOW_META[project.workflow_status] ?? WORKFLOW_META.not_started;
  const needsVerify = lib ? lib.status !== 'current' : false;

  const mine = async () => {
    if (mining) return;
    setMining(true); setErr(null);
    try {
      await fetchStreamedJson('/api/essay-angles', { projectId });
      await load();
      setTab('angles');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Angle generation failed.'); }
    finally { setMining(false); }
  };

  const setDisposition = async (angleId: string, disposition: AngleDisposition) => {
    if (savingId) return;
    setSavingId(angleId); setErr(null);
    const { error } = await supabase.from('essay_angles').update({ disposition }).eq('id', angleId);
    if (!error && disposition === 'selected') {
      await supabase.from('essay_projects')
        .update({ selected_angle_id: angleId, workflow_status: 'angle_selected', updated_at: new Date().toISOString() })
        .eq('id', projectId);
      // Only one selected angle at a time.
      await supabase.from('essay_angles').update({ disposition: 'saved' })
        .eq('project_id', projectId).eq('disposition', 'selected').neq('id', angleId);
    }
    if (error) setErr(error.message);
    setSavingId(null);
    await load();
  };

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <Link href={`/students/${studentId}/essays`} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-3">
        <ArrowLeft size={13} /> All essays
      </Link>
      <PageHeader
        title={school?.short ?? project.school_id}
        sub={promptText.length > 140 ? `${promptText.slice(0, 140)}…` : promptText}
        actions={<Chip tone={meta.tone}>{meta.label}</Chip>}
      />

      {err && <div className="mb-4"><AlertCard tone="critical" title="Error" body={err} /></div>}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-[var(--line)]">
        {([['understand', 'Understand the Prompt'], ['angles', `Explore Angles${angles.length ? ` (${angles.length})` : ''}`], ['draft', 'Draft & Review']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-[13.5px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'understand' && (
        <div className="flex flex-col gap-4">
          {needsVerify && lib && (
            <AlertCard tone="warning" title={`This prompt belongs to the ${lib.admissionCycle} cycle`}
              body="Verify the current prompt on the school's official application page before drafting." />
          )}
          <Card title="The prompt" bodyClassName="px-6 py-5">
            <p className="text-[15px] text-[var(--ink)] leading-relaxed">{promptText}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {wordLimit && <Chip tone="neutral">{wordLimit} words</Chip>}
              <Chip tone="accent">{lib ? PROMPT_TYPE_META[lib.promptType].label : (project.custom_prompt?.promptType ? PROMPT_TYPE_META[project.custom_prompt.promptType].label : 'Custom')}</Chip>
              {lib && <Chip tone={lib.status === 'current' ? 'positive' : 'warning'}>{lib.status === 'current' ? `Current · ${lib.admissionCycle}` : `Verify · ${lib.admissionCycle}`}</Chip>}
              {!lib && <Chip tone="neutral">User-added</Chip>}
              {project.program && <Chip tone="info">{project.program}</Chip>}
            </div>
          </Card>
          <Card title="What this school is really asking" bodyClassName="px-6 py-5">
            <p className="text-[13px] text-[var(--muted)] leading-relaxed">
              Mine angles to see how this prompt connects to {student.name.split(' ')[0]}&apos;s confirmed identity, real evidence, and {school?.short ?? 'the school'}&apos;s verified traits — each angle names what it answers and what still needs checking.
            </p>
            <div className="mt-4">
              <PrimaryButton onClick={mine} className={mining ? 'opacity-60 pointer-events-none' : ''}>
                {mining ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {angles.length ? 'Mine more angles' : 'Mine angles'}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {tab === 'angles' && (
        <div className="flex flex-col gap-4">
          {angles.length === 0 && (
            <Card bodyClassName="px-6 py-10 text-center">
              <p className="text-[13.5px] text-[var(--muted)] mb-4">No angles yet — mine 3–5 evidence-backed directions for this prompt.</p>
              <PrimaryButton onClick={mine} className={mining ? 'opacity-60 pointer-events-none' : ''}>
                {mining ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Mine angles
              </PrimaryButton>
            </Card>
          )}
          {angles.map(a => {
            const d = a.data;
            const selected = a.disposition === 'selected';
            return (
              <Card key={a.id} className={selected ? 'border-emerald-300' : ''} bodyClassName="px-6 py-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <h3 className="text-[15.5px] font-bold text-[var(--ink)] leading-snug flex-1 min-w-0">{d.angle}</h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Chip tone="info">Working hypothesis</Chip>
                    {selected && <Chip tone="positive"><Check size={11} /> Selected</Chip>}
                    {a.disposition === 'saved' && <Chip tone="neutral">Saved</Chip>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <Eyebrow>Uses this real evidence</Eyebrow>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {d.personalEvidence.map((e, i) => <span key={i} className="text-[12px] bg-[var(--bg-soft)] border border-[var(--line)] rounded-full px-2.5 py-0.5 text-[var(--ink)]">{e}</span>)}
                    </div>
                    <div className="mt-3"><Eyebrow>Master-line link</Eyebrow>
                      <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed mt-1">{d.masterLineLink}</p></div>
                  </div>
                  <div>
                    <Eyebrow>School hook</Eyebrow>
                    <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed mt-1">
                      {d.schoolHook}{' '}
                      {d.schoolHookStatus === 'unverified' && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#B45309] bg-[#FEF3C7] rounded px-1.5 py-0.5 align-middle"><AlertTriangle size={10} /> verify on the official page</span>
                      )}
                    </p>
                    <div className="mt-3 grid gap-2">
                      <p className="text-[12px] text-[var(--muted)] leading-relaxed"><span className="font-semibold text-[#B45309]">Repetition:</span> {d.repetitionRisk}</p>
                      <p className="text-[12px] text-[var(--muted)] leading-relaxed"><span className="font-semibold text-[#B45309]">Cliché:</span> {d.clicheRisk}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--line)]">
                  <Eyebrow>Answer these before drafting</Eyebrow>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {d.openQuestions.map((q, i) => <li key={i} className="text-[12.5px] text-[var(--ink)] leading-relaxed">· {q}</li>)}
                  </ul>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 flex-wrap">
                  <GhostButton onClick={() => setDisposition(a.id, 'rejected')} className={savingId ? 'opacity-50 pointer-events-none' : ''}><X size={13} /> Reject</GhostButton>
                  {a.disposition === 'proposed' && (
                    <GhostButton onClick={() => setDisposition(a.id, 'saved')} className={savingId ? 'opacity-50 pointer-events-none' : ''}><BookmarkPlus size={13} /> Save</GhostButton>
                  )}
                  {!selected && (
                    <PrimaryButton onClick={() => setDisposition(a.id, 'selected')} className={savingId ? 'opacity-50 pointer-events-none' : ''}>
                      <Check size={14} /> Select as direction
                    </PrimaryButton>
                  )}
                </div>
              </Card>
            );
          })}
          {angles.length > 0 && (
            <div className="flex justify-center">
              <GhostButton onClick={mine} className={mining ? 'opacity-60 pointer-events-none' : ''}>
                {mining ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Mine more angles
              </GhostButton>
            </div>
          )}
        </div>
      )}

      {tab === 'draft' && (
        <DraftReview
          projectId={projectId}
          wordLimit={wordLimit}
          workflowStatus={project.workflow_status}
          onChanged={() => { void load(); }}
        />
      )}
    </div>
  );
}
