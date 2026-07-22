'use client';

/**
 * Draft & Review (E3). Text-only drafts, an append-only version history, and
 * AO-style structured critique. The reviewer quotes the student's own
 * sentences and asks questions — replacement prose does not exist here.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2, Save, Sparkles, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { fetchStreamedJson } from '@/lib/essays/streamJson';
import { Card, Chip, AlertCard, PrimaryButton, GhostButton, Eyebrow, type Tone } from '@/components/ui';
import { RUBRIC_LABEL, type EssayReview, type RubricDimension } from '@/lib/essays/reviewSchema';

interface RevisionRow { id: string; revision_number: number; name: string | null; content: string; word_count: number; created_at: string }
interface ReviewRow { id: string; revision_id: string; data: EssayReview; created_at: string }

const RUBRIC_TONE: Record<string, Tone> = { strong: 'positive', adequate: 'accent', weak: 'warning' };
const CLAIM_TONE: Record<string, Tone> = { confirmed: 'positive', needs_verification: 'warning', unsupported: 'critical', potentially_overstated: 'warning' };
const CLAIM_LABEL: Record<string, string> = { confirmed: 'Confirmed', needs_verification: 'Needs verification', unsupported: 'Unsupported', potentially_overstated: 'Potentially overstated' };
const RANK: Record<string, number> = { weak: 0, adequate: 1, strong: 2 };

export function DraftReview({ projectId, wordLimit, workflowStatus, onChanged }: {
  projectId: string; wordLimit?: number; workflowStatus: string; onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const draftKey = `essay-draft:${projectId}`;

  const [text, setText] = useState('');
  const [versionName, setVersionName] = useState('');
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [viewRevId, setViewRevId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'review' | 'final'>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: revs } = await supabase.from('essay_revisions')
      .select('*').eq('project_id', projectId).order('revision_number', { ascending: false });
    const list = (revs ?? []) as RevisionRow[];
    setRevisions(list);
    if (list.length) {
      const { data: rvw } = await supabase.from('essay_reviews')
        .select('*').in('revision_id', list.map(r => r.id)).order('created_at', { ascending: false });
      setReviews((rvw ?? []) as ReviewRow[]);
    } else setReviews([]);
  }, [supabase, projectId]);

  // Restore the local autosave, then load history — hydration, not a cascade.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(draftKey) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setText(saved);
    void load();
  }, [draftKey, load]);

  // Autosave the working draft locally (never touches saved versions).
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(draftKey, text); } catch { /* full */ } }, 600);
    return () => clearTimeout(t);
  }, [text, draftKey]);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const over = wordLimit !== undefined && words > wordLimit;

  const saveVersion = async () => {
    if (!text.trim() || busy) return;
    setBusy('save'); setErr(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('Session expired — refresh and sign in again.'); setBusy(null); return; }
    const nextNum = (revisions[0]?.revision_number ?? 0) + 1;
    const { error } = await supabase.from('essay_revisions').insert({
      project_id: projectId, user_id: user.id, revision_number: nextNum,
      name: versionName.trim() || null, content: text, word_count: words, source: 'student',
    });
    if (error) { setErr(error.message); setBusy(null); return; }
    if (workflowStatus === 'not_started' || workflowStatus === 'exploring_angles' || workflowStatus === 'angle_selected') {
      await supabase.from('essay_projects').update({ workflow_status: 'drafting', updated_at: new Date().toISOString() }).eq('id', projectId);
    }
    setVersionName('');
    setBusy(null);
    await load();
    onChanged();
  };

  const requestReview = async (revisionId: string) => {
    if (busy) return;
    setBusy('review'); setErr(null);
    try {
      await supabase.from('essay_projects').update({ workflow_status: 'ready_for_review', updated_at: new Date().toISOString() }).eq('id', projectId);
      await fetchStreamedJson('/api/essay-review', { revisionId });
      await load();
      onChanged();
      setViewRevId(revisionId);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Review failed.'); }
    finally { setBusy(null); }
  };

  const markFinal = async () => {
    if (busy) return;
    setBusy('final');
    await supabase.from('essay_projects').update({ workflow_status: 'final', updated_at: new Date().toISOString() }).eq('id', projectId);
    setBusy(null);
    onChanged();
  };

  const viewed = revisions.find(r => r.id === viewRevId) ?? revisions[0] ?? null;
  const viewedReviews = viewed ? reviews.filter(r => r.revision_id === viewed.id) : [];
  const latestReview = viewedReviews[0] ?? null;
  // Progress vs the most recent review of any EARLIER revision.
  const prevReview = viewed
    ? reviews.find(r => {
        const rev = revisions.find(x => x.id === r.revision_id);
        return rev && rev.revision_number < viewed.revision_number;
      }) ?? null
    : null;

  return (
    <div className="flex flex-col gap-4">
      {err && <AlertCard tone="critical" title="Error" body={err} />}

      {/* Working draft */}
      <Card title="Working draft" sub="Autosaved locally as you type. Saved versions are permanent — history is never overwritten." bodyClassName="px-6 py-5">
        <textarea
          rows={12}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste or write your draft here…"
          className="w-full px-3.5 py-3 rounded-lg border border-[var(--line-strong)] text-[13.5px] leading-relaxed bg-white resize-y focus:outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <span className={`text-[12.5px] tabular-nums font-semibold ${over ? 'text-red-600' : 'text-[var(--muted)]'}`}>
            {words}{wordLimit ? ` / ${wordLimit}` : ''} words{over ? ' — over limit' : ''}
          </span>
          <div className="flex items-center gap-2">
            <input
              value={versionName} onChange={e => setVersionName(e.target.value)}
              placeholder="Version name (optional)"
              className="px-3 py-1.5 rounded-lg border border-[var(--line-strong)] text-[12.5px] bg-white focus:outline-none focus:border-[var(--accent)]"
            />
            <PrimaryButton onClick={saveVersion} className={!text.trim() || busy ? 'opacity-50 pointer-events-none' : ''}>
              {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save version {(revisions[0]?.revision_number ?? 0) + 1}
            </PrimaryButton>
          </div>
        </div>
      </Card>

      {/* Version history + review */}
      {revisions.length > 0 && viewed && (
        <Card
          title="Versions & reviews"
          actions={workflowStatus !== 'final' ? (
            <GhostButton onClick={markFinal} className={busy ? 'opacity-50 pointer-events-none' : ''}><CheckCircle2 size={13} /> Mark final</GhostButton>
          ) : <Chip tone="positive">Final</Chip>}
          bodyClassName="px-6 py-5"
        >
          <div className="flex flex-wrap gap-1.5 mb-4">
            {revisions.map(r => (
              <button key={r.id} onClick={() => setViewRevId(r.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                  viewed.id === r.id ? 'bg-[var(--accent)] text-white border-transparent' : 'bg-white border-[var(--line-strong)] text-[var(--muted)] hover:bg-[var(--bg-soft)]'}`}>
                v{r.revision_number}{r.name ? ` · ${r.name}` : ''}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-4 py-3 mb-4 max-h-48 overflow-y-auto">
            <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed whitespace-pre-wrap">{viewed.content}</p>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <span className="text-[11.5px] text-[var(--muted)]">v{viewed.revision_number} · {viewed.word_count} words · {new Date(viewed.created_at).toLocaleDateString()}</span>
            <PrimaryButton onClick={() => requestReview(viewed.id)} className={busy ? 'opacity-50 pointer-events-none' : ''}>
              {busy === 'review' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {viewedReviews.length ? 'Review again' : 'Request review'}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {/* Latest review of the viewed revision */}
      {latestReview && viewed && (
        <Card title={`Review — v${viewed.revision_number}`} sub="Quotes are the student's own sentences. Guidance is questions, never replacement text." bodyClassName="px-6 py-5">
          <div className="rounded-lg border-l-4 border-l-[var(--accent)] border border-[var(--line)] bg-[var(--accent-50)] px-4 py-3 mb-5">
            <Eyebrow>AO first read</Eyebrow>
            <p className="text-[13.5px] text-[var(--ink)] leading-relaxed mt-1">{latestReview.data.aoFirstRead}</p>
          </div>

          <Eyebrow>Rubric</Eyebrow>
          <div className="mt-2 mb-5 flex flex-col gap-2.5">
            {latestReview.data.rubric.map(r => {
              const prev = prevReview?.data.rubric.find(p => p.dimension === r.dimension);
              const delta = prev ? RANK[r.status] - RANK[prev.status] : 0;
              return (
                <div key={r.dimension} className="rounded-lg border border-[var(--line)] px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[13px] font-bold text-[var(--ink)]">{RUBRIC_LABEL[r.dimension as RubricDimension]}</span>
                    <Chip tone={RUBRIC_TONE[r.status]}>{r.status}</Chip>
                    {prev && delta !== 0 && (
                      <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} vs prior
                      </span>
                    )}
                    {prev && delta === 0 && <span className="inline-flex items-center gap-0.5 text-[10.5px] text-[var(--muted)]"><Minus size={11} /> unchanged</span>}
                  </div>
                  <p className="text-[12px] text-[var(--muted)] italic leading-relaxed">“{r.quote}”</p>
                  <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed mt-1">{r.diagnosis}</p>
                  <p className="text-[12.5px] text-[var(--accent)] font-medium leading-relaxed mt-1">→ {r.revisionQuestion}</p>
                </div>
              );
            })}
          </div>

          {latestReview.data.claims.length > 0 && (
            <>
              <Eyebrow>Evidence & claims</Eyebrow>
              <div className="mt-2 mb-5 flex flex-col gap-2">
                {latestReview.data.claims.map((c, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Chip tone={CLAIM_TONE[c.status]}>{CLAIM_LABEL[c.status]}</Chip>
                    <div className="min-w-0">
                      <p className="text-[12px] text-[var(--ink)] italic leading-snug">“{c.quote}”</p>
                      <p className="text-[11.5px] text-[var(--muted)] leading-relaxed">{c.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-[#FEF9F0] border border-[var(--line)] border-l-4 border-l-[#D97706] px-4 py-3">
              <Eyebrow>Revision priorities (max 3)</Eyebrow>
              <ol className="mt-1.5 flex flex-col gap-1">
                {latestReview.data.revisionPriorities.map((pr, i) => (
                  <li key={i} className="text-[12.5px] text-[var(--ink)] leading-relaxed flex gap-2"><span className="font-bold text-[#B45309]">{i + 1}.</span>{pr}</li>
                ))}
              </ol>
            </div>
            <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-4 py-3">
              <Eyebrow>Next-draft questions</Eyebrow>
              <ul className="mt-1.5 flex flex-col gap-1">
                {latestReview.data.nextDraftQuestions.map((q, i) => (
                  <li key={i} className="text-[12.5px] text-[var(--ink)] leading-relaxed">· {q}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
