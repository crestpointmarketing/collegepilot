'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronDown, Sparkles, ArrowRight, Trophy, CircleHelp, Compass,
  ClipboardList, TriangleAlert,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  DIMENSION_GROUPS, DIMENSION_LABELS, TIER_SCORE,
  ConfidenceChip, EvidenceDonut, TierBar, VerificationBadge, computeReadiness,
  type V2Dimension,
} from '@/components/assessment/ui';

export default function AssessmentPage() {
  const params = useParams();
  const { students, strategies } = useApp();
  const studentId = params.studentId as string;
  const student = students.find(s => s.id === studentId);
  const v2 = strategies[studentId]?.v2 ?? null;
  const [openDim, setOpenDim] = useState<string | null>(null);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  if (!v2?.assessment) {
    return (
      <div className="animate-fade-in">
        <PageHead name={student.name} generatedAt={null} readinessPct={null} />
        <div className="bg-white rounded-card shadow-card p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-50)] flex items-center justify-center mx-auto mb-4">
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 className="text-[16px] font-semibold text-[var(--ink)] mb-2">No assessment yet</h3>
          <p className="text-[13px] text-[var(--muted)] mb-6 max-w-sm mx-auto">
            The ten-dimension evidence assessment is produced when a strategy is generated.
          </p>
          <Link href={`/students/${studentId}/strategy`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium" style={{ background: 'var(--accent)' }}>
            Generate a strategy <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const assessment = v2.assessment;
  const dims = assessment.dimensions;
  const readiness = computeReadiness(dims);

  // Reader summary: strongest anchored dimension, biggest open question, first-read
  const ranked = Object.entries(dims).sort((a, b) =>
    (TIER_SCORE[b[1].tier] ?? 0) - (TIER_SCORE[a[1].tier] ?? 0) ||
    (b[1].verifiability === 'externally_verified' ? 1 : 0) - (a[1].verifiability === 'externally_verified' ? 1 : 0));
  const strongest = ranked[0];
  const gaps = Object.entries(dims).flatMap(([key, d]) => d.missing.map(m => ({ dimension: key, gap: m })));
  const overstated = Object.entries(dims).filter(([, d]) => d.overstatement_risk === 'high' || d.overstatement_risk === 'medium');

  return (
    <div className="animate-fade-in">
      <PageHead name={student.name} generatedAt={v2.generatedAt} readinessPct={readiness.pct} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Dimension table */}
        <div className="lg:col-span-2 bg-white rounded-card shadow-card">
          <div className="px-6 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[var(--ink)]">Ten-Dimension First Read</h2>
            <span className="text-[11px] text-[var(--muted)]">click a row for evidence</span>
          </div>
          <div className="px-6 py-3">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-2 border-b border-[var(--line)] text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              <span>Dimension</span><span>Rating</span><span>Confidence</span><span>Verification</span>
            </div>
            {DIMENSION_GROUPS.map(group => (
              <div key={group.title}>
                <div className="pt-3 pb-1 text-[11px] font-bold" style={{ color: group.color }}>{group.title}</div>
                {group.keys.map(key => {
                  const d = dims[key];
                  if (!d) return null;
                  const open = openDim === key;
                  return (
                    <div key={key} className="border-b border-[var(--line)] last:border-0">
                      <button
                        onClick={() => setOpenDim(open ? null : key)}
                        className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-2.5 text-left hover:bg-[var(--bg-soft)] transition-colors rounded"
                      >
                        <span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink)]">
                          <ChevronDown size={12} className={`text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
                          {DIMENSION_LABELS[key] ?? key}
                        </span>
                        <TierBar tier={d.tier} color={group.color} />
                        <ConfidenceChip level={d.confidence} />
                        <VerificationBadge state={d.verifiability} compact />
                      </button>
                      {open && <DimensionDetail d={d} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Reader summary */}
          <section className="bg-white rounded-card shadow-card px-5 py-4">
            <h2 className="text-[14px] font-semibold text-[var(--ink)] mb-3">Admissions Reader Summary</h2>
            <div className="flex flex-col gap-3">
              <SummaryRow icon={<Trophy size={14} className="text-emerald-600" />} label="Strongest signal">
                {strongest ? `${DIMENSION_LABELS[strongest[0]]} — ${strongest[1].evidence[0] ?? strongest[1].tier}` : '—'}
              </SummaryRow>
              <SummaryRow icon={<CircleHelp size={14} className="text-amber-500" />} label="Open question">
                {assessment.key_risks[0] ?? 'None flagged.'}
              </SummaryRow>
              <SummaryRow icon={<Compass size={14} className="text-blue-500" />} label="First read">
                {assessment.profile_read}
              </SummaryRow>
              {assessment.spike.has_spike && (
                <SummaryRow icon={<Sparkles size={14} style={{ color: 'var(--accent)' }} />} label="Spike">
                  {assessment.spike.domain}
                </SummaryRow>
              )}
            </div>
          </section>

          {/* Evidence quality */}
          <section className="bg-white rounded-card shadow-card px-5 py-4">
            <h2 className="text-[14px] font-semibold text-[var(--ink)] mb-3">Evidence Quality</h2>
            <EvidenceDonut dimensions={dims} />
            {overstated.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11.5px] text-amber-800">
                <TriangleAlert size={13} className="shrink-0 mt-0.5" />
                <span>Overstatement risk on: {overstated.map(([k]) => DIMENSION_LABELS[k]).join(', ')} — claims outrun what current evidence can support.</span>
              </div>
            )}
          </section>

          {/* Evidence gaps */}
          <section className="bg-white rounded-card shadow-card px-5 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <ClipboardList size={14} className="text-[var(--muted)]" />
              <h2 className="text-[14px] font-semibold text-[var(--ink)]">Evidence Gaps</h2>
              <span className="ml-auto text-[11px] text-[var(--muted)]">{gaps.length} open</span>
            </div>
            {gaps.length === 0 ? (
              <p className="text-[12px] text-[var(--muted)]">No missing evidence flagged.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {gaps.slice(0, 8).map((g, i) => (
                  <div key={i} className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-3 py-2">
                    <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed">{g.gap}</p>
                    <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wide">{DIMENSION_LABELS[g.dimension]}</span>
                  </div>
                ))}
                {gaps.length > 8 && <span className="text-[11px] text-[var(--muted)]">+{gaps.length - 8} more inside the dimension rows above</span>}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Evidence map */}
      <section className="mt-4 bg-white rounded-card shadow-card">
        <div className="px-6 py-3.5 border-b border-[var(--line)] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Evidence Map</h2>
          <span className="text-[11px] text-[var(--muted)]">every cited item, with its verification state</span>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {Object.entries(dims).flatMap(([key, d]) =>
            d.evidence.map((item, i) => (
              <div key={`${key}-${i}`} className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2.5 flex flex-col gap-1.5">
                <p className="text-[12px] text-[var(--ink-soft)] leading-relaxed">{item}</p>
                <div className="flex items-center gap-2 mt-auto">
                  <VerificationBadge state={d.verifiability} />
                  <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide ml-auto">{DIMENSION_LABELS[key]}</span>
                </div>
              </div>
            )),
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────── */

function PageHead({ name, generatedAt, readinessPct }: { name: string; generatedAt: string | null; readinessPct: number | null }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">Assessment</h1>
        <p className="text-[var(--muted)] mt-1">{name} · evidence-based first read</p>
      </div>
      <div className="flex items-center gap-2">
        {readinessPct !== null && (
          <span className="text-[12px] font-semibold px-3 py-1.5 rounded-pill bg-[var(--accent-50)] border border-[var(--accent-100)]" style={{ color: 'var(--accent)' }}>
            Evidence readiness {readinessPct}%
          </span>
        )}
        {generatedAt && (
          <span className="text-[12px] text-[var(--muted)]">
            Updated {new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</div>
        <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function DimensionDetail({ d }: { d: V2Dimension }) {
  return (
    <div className="mx-1 mb-3 rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-4 py-3 flex flex-col gap-2.5">
      {d.reader_interpretation && (
        <DetailBlock title="How a reader sees it">{d.reader_interpretation}</DetailBlock>
      )}
      {d.evidence.length > 0 && (
        <DetailBlock title="Evidence cited">
          <ul className="flex flex-col gap-1">{d.evidence.map((e, i) => <li key={i}>· {e}</li>)}</ul>
        </DetailBlock>
      )}
      {d.missing.length > 0 && (
        <DetailBlock title="Missing — would change this grade">
          <ul className="flex flex-col gap-1">{d.missing.map((e, i) => <li key={i}>· {e}</li>)}</ul>
        </DetailBlock>
      )}
      {d.risks.length > 0 && (
        <DetailBlock title="Risks a reader would flag">
          <ul className="flex flex-col gap-1">{d.risks.map((e, i) => <li key={i}>· {e}</li>)}</ul>
        </DetailBlock>
      )}
      {d.overstatement_risk && d.overstatement_risk !== 'low' && (
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700">
          <TriangleAlert size={12} /> Overstatement risk: {d.overstatement_risk}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{title}</div>
      <div className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed">{children}</div>
    </div>
  );
}
