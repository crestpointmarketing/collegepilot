'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PenLine, Plus, ArrowRight, X, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { SCHOOLS } from '@/lib/schools';
import { promptsForSchool, getPrompt, LIBRARY_SCHOOL_IDS } from '@/lib/essays/promptLibrary';
import { WORKFLOW_META, PROMPT_TYPE_META, type EssayProjectRow, type PromptType } from '@/lib/essays/types';
import { PageHeader, Chip, StatTile, EmptyState, PrimaryButton, GhostButton, AlertCard } from '@/components/ui';

export default function EssaysPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, strategies } = useApp();
  const student = students.find(s => s.id === studentId);
  const v2 = strategies[studentId]?.v2 ?? null;
  const supabase = useMemo(() => createClient(), []);

  const [projects, setProjects] = useState<EssayProjectRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('essay_projects')
      .select('*').eq('student_id', studentId).order('created_at', { ascending: true });
    if (error) { setLoadError(error.message); setProjects([]); return; }
    setLoadError(null);
    setProjects((data ?? []) as EssayProjectRow[]);
  }, [supabase, studentId]);

  // Async fetch-on-mount: every setState happens after an await, never synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  const stats = {
    total: projects?.length ?? 0,
    angles: projects?.filter(p => ['exploring_angles', 'angle_selected'].includes(p.workflow_status)).length ?? 0,
    drafting: projects?.filter(p => ['drafting', 'ready_for_review', 'needs_revision'].includes(p.workflow_status)).length ?? 0,
    final: projects?.filter(p => p.workflow_status === 'final').length ?? 0,
  };

  const bySchool = new Map<string, EssayProjectRow[]>();
  for (const p of projects ?? []) {
    bySchool.set(p.school_id, [...(bySchool.get(p.school_id) ?? []), p]);
  }

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <PageHeader
        title="Essays"
        sub="Angle mining, prompt mapping, and draft critique — the guide never writes; the essay stays yours."
        actions={<PrimaryButton onClick={() => setAdding(true)}><Plus size={15} /> Add essay</PrimaryButton>}
      />

      {loadError && (
        <div className="mb-4">
          <AlertCard tone="critical" title="Essays tables unavailable"
            body={`${loadError} — if this mentions a missing table, run supabase/essays.sql in the Supabase SQL editor once.`} />
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatTile label="Essays" value={String(stats.total)} />
          <StatTile label="Exploring / angle set" value={String(stats.angles)} accent />
          <StatTile label="Drafting / review" value={String(stats.drafting)} />
          <StatTile label="Final" value={String(stats.final)} />
        </div>
      )}

      {projects && projects.length === 0 && !loadError && (
        <EmptyState
          icon={<PenLine size={24} />}
          title="No essays yet"
          body="Add a supplemental prompt from the 20-school library — or paste any school's prompt yourself — and start mining angles grounded in real evidence."
          action={<PrimaryButton onClick={() => setAdding(true)}><Plus size={15} /> Add your first essay</PrimaryButton>}
        />
      )}

      <div className="flex flex-col gap-4">
        {[...bySchool.entries()].map(([schoolId, list]) => {
          const school = SCHOOLS.find(s => s.id === schoolId);
          return (
            <section key={schoolId} className="bg-white rounded-card shadow-card border border-[var(--line)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--line)] flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-[var(--ink)]">{school?.name ?? schoolId}</h2>
                <span className="text-[11.5px] text-[var(--muted)]">{list.length} prompt{list.length === 1 ? '' : 's'}</span>
              </div>
              <div className="px-3 py-2 flex flex-col">
                {list.map(p => {
                  const lib = p.prompt_id ? getPrompt(p.prompt_id) : undefined;
                  const text = lib?.promptText ?? p.custom_prompt?.promptText ?? '';
                  const meta = WORKFLOW_META[p.workflow_status] ?? WORKFLOW_META.not_started;
                  return (
                    <Link key={p.id} href={`/students/${studentId}/essays/${p.id}`}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[var(--bg-soft)] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--ink)] truncate">{text}</p>
                        <p className="text-[11px] text-[var(--muted)] mt-0.5">
                          {lib ? PROMPT_TYPE_META[lib.promptType].label : 'Custom prompt'}
                          {lib?.wordLimit ? ` · ${lib.wordLimit} words` : p.custom_prompt?.wordLimit ? ` · ${p.custom_prompt.wordLimit} words` : ''}
                          {p.program ? ` · ${p.program}` : ''}
                        </p>
                      </div>
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                      <ArrowRight size={13} className="text-[var(--muted)] shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {adding && (
        <AddEssayModal
          studentId={studentId}
          preferredSchoolIds={v2?.evaluations?.map(e => e.schoolId) ?? student.preferredSchoolIds ?? []}
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); void load(); }}
        />
      )}
    </div>
  );
}

/* ── Add-essay modal: library prompts or a custom pasted prompt ── */
function AddEssayModal({ studentId, preferredSchoolIds, onClose, onCreated }: {
  studentId: string; preferredSchoolIds: string[]; onClose: () => void; onCreated: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [schoolId, setSchoolId] = useState('');
  const [mode, setMode] = useState<'library' | 'custom'>('library');
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState('');
  const [customLimit, setCustomLimit] = useState('');
  const [customType, setCustomType] = useState<PromptType>('other');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const library = schoolId ? promptsForSchool(schoolId) : [];
  const onList = SCHOOLS.filter(s => preferredSchoolIds.includes(s.id));
  const others = SCHOOLS.filter(s => !preferredSchoolIds.includes(s.id));

  const create = async () => {
    if (!schoolId || saving) return;
    setSaving(true); setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Session expired — refresh and sign in again.'); setSaving(false); return; }
    const rows = mode === 'library'
      ? [...pickedIds].map(pid => ({ student_id: studentId, user_id: user.id, school_id: schoolId, prompt_id: pid }))
      : [{
          student_id: studentId, user_id: user.id, school_id: schoolId, prompt_id: null,
          custom_prompt: { promptText: customText.trim(), wordLimit: customLimit ? parseInt(customLimit) : undefined, promptType: customType },
        }];
    if (mode === 'custom' && !customText.trim()) { setErr('Paste the prompt text first.'); setSaving(false); return; }
    if (mode === 'library' && rows.length === 0) { setErr('Pick at least one prompt.'); setSaving(false); return; }
    const { error } = await supabase.from('essay_projects').insert(rows);
    setSaving(false);
    if (error) { setErr(`${error.message} — if this mentions a missing table, run supabase/essays.sql once.`); return; }
    onCreated();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} style={{ backdropFilter: 'blur(2px)' }} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[560px] z-50 bg-white shadow-drawer flex flex-col animate-slide-in" role="dialog" aria-modal="true">
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between shrink-0">
          <h2 className="text-[16px] font-bold text-[var(--ink)]">Add essay prompt</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:bg-[var(--bg-soft)]" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">School</label>
            <select value={schoolId} onChange={e => { setSchoolId(e.target.value); setPickedIds(new Set()); setMode('library'); }}
              className="w-full px-3 py-2 rounded-lg border border-[var(--line-strong)] text-[13.5px] bg-white focus:outline-none focus:border-[var(--accent)]">
              <option value="">Select a school…</option>
              {onList.length > 0 && <optgroup label="On this student's list">{onList.map(s => <option key={s.id} value={s.id}>{s.short}{LIBRARY_SCHOOL_IDS.includes(s.id) ? '' : ' (custom prompt only)'}</option>)}</optgroup>}
              <optgroup label="All schools">{others.map(s => <option key={s.id} value={s.id}>{s.short}{LIBRARY_SCHOOL_IDS.includes(s.id) ? '' : ' (custom prompt only)'}</option>)}</optgroup>
            </select>
          </div>

          {schoolId && (
            <div className="flex gap-2">
              {(['library', 'custom'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} disabled={m === 'library' && library.length === 0}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold border transition-colors disabled:opacity-40 ${
                    mode === m ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-white border-[var(--line-strong)] text-[var(--muted)]'}`}>
                  {m === 'library' ? `From library (${library.length})` : 'Custom prompt'}
                </button>
              ))}
            </div>
          )}

          {schoolId && mode === 'library' && library.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11.5px] text-[var(--muted)] flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-[#D97706]" />
                Library prompts are from the {library[0].admissionCycle} cycle — verify the current prompt on the official page before drafting.
              </p>
              {library.map(pr => {
                const on = pickedIds.has(pr.id);
                return (
                  <button key={pr.id} onClick={() => setPickedIds(prev => { const n = new Set(prev); if (n.has(pr.id)) n.delete(pr.id); else n.add(pr.id); return n; })}
                    className={`text-left rounded-lg border px-3.5 py-2.5 transition-colors ${on ? 'border-[var(--accent)] bg-[var(--accent-50)]' : 'border-[var(--line)] bg-white hover:bg-[var(--bg-soft)]'}`}>
                    <p className="text-[12.5px] text-[var(--ink)] leading-snug">{pr.promptText}</p>
                    <p className="text-[11px] text-[var(--muted)] mt-1">
                      {PROMPT_TYPE_META[pr.promptType].label}{pr.wordLimit ? ` · ${pr.wordLimit} words` : ''} · {pr.status === 'current' ? 'current' : `⚠ verify (${pr.admissionCycle})`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {schoolId && (mode === 'custom' || library.length === 0) && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">Prompt text (paste from the official application)</label>
                <textarea rows={4} value={customText} onChange={e => setCustomText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--line-strong)] text-[13.5px] bg-white resize-none focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">Word limit</label>
                  <input type="number" value={customLimit} onChange={e => setCustomLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--line-strong)] text-[13.5px] bg-white focus:outline-none focus:border-[var(--accent)]" placeholder="e.g. 250" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--ink)] mb-1.5 uppercase tracking-wide">Type</label>
                  <select value={customType} onChange={e => setCustomType(e.target.value as PromptType)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--line-strong)] text-[13.5px] bg-white focus:outline-none focus:border-[var(--accent)]">
                    {Object.entries(PROMPT_TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {err && <AlertCard tone="critical" title="Could not add" body={err} />}
        </div>
        <div className="px-6 py-4 border-t border-[var(--line)] flex gap-2 justify-end shrink-0">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={create} className={saving || !schoolId ? 'opacity-50 pointer-events-none' : ''}>
            {saving ? 'Adding…' : 'Add'}
          </PrimaryButton>
        </div>
      </div>
    </>
  );
}
