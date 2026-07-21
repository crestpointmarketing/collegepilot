'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ArrowRight } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { DIMENSION_LABELS } from '@/components/assessment/ui';
import { DIMENSION_KEYS, type DimensionKey } from '@/lib/admissions/assessment';
import {
  PageHeader, Card, AlertCard, Chip, ConfidenceDot, Eyebrow, EmptyState, PrimaryButton,
  type Tone, type ConfidenceLevel,
} from '@/components/ui';

const TIER_META: Record<string, { pct: number; bar: string; text: string; tone: Tone; label: string }> = {
  exceptional: { pct: 92, bar: 'bg-[#16A34A]', text: 'text-[#16A34A]', tone: 'positive', label: 'Exceptional' },
  strong:      { pct: 80, bar: 'bg-[#16A34A]', text: 'text-[#16A34A]', tone: 'positive', label: 'Strong' },
  solid:       { pct: 62, bar: 'bg-[var(--accent)]', text: 'text-[var(--accent)]', tone: 'accent', label: 'Solid' },
  developing:  { pct: 45, bar: 'bg-[#D97706]', text: 'text-[#D97706]', tone: 'warning', label: 'Developing' },
  concern:     { pct: 28, bar: 'bg-[#DC2626]', text: 'text-[#DC2626]', tone: 'critical', label: 'Concern' },
};
const CONF_LEVEL: Record<string, ConfidenceLevel> = { high: 'High', medium: 'Moderate', low: 'Low' };
const OVERSTATE: Record<string, string> = {
  low: 'Low — reasonable support', medium: 'Moderate — watch the framing', high: 'High — limited evidence',
};

export default function AssessmentPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const { students, strategies } = useApp();
  const student = students.find(s => s.id === studentId);
  const v2 = strategies[studentId]?.v2 ?? null;
  const [sel, setSel] = useState(0);

  if (!student) return <div className="text-[var(--muted)]">Student not found.</div>;

  if (!v2?.assessment) {
    return (
      <div className="animate-fade-in max-w-[1080px] mx-auto">
        <PageHeader title="10-Dimension Assessment" sub="How the current record may be read in an admissions context" />
        <EmptyState
          icon={<ClipboardCheck size={24} />}
          title="No assessment yet"
          body="The ten-dimension evidence assessment is produced when a strategy is generated."
          action={<PrimaryButton href={`/students/${studentId}/strategy`}>Generate a strategy <ArrowRight size={15} /></PrimaryButton>}
        />
      </div>
    );
  }

  const dims = v2.assessment.dimensions;
  const keys = DIMENSION_KEYS.filter(k => dims[k]);
  const selKey = (keys[sel] ?? keys[0]) as DimensionKey;
  const d = dims[selKey];
  const dm = TIER_META[d.tier] ?? TIER_META.solid;

  return (
    <div className="animate-fade-in max-w-[1080px] mx-auto">
      <PageHeader title="10-Dimension Assessment" sub="How the current record may be read in an admissions context" />
      <AlertCard tone="accent" title="Qualitative interpretation — not a score."
        body="Confidence levels matter as much as tier ratings. Each dimension is one lens, not the full picture." />

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Dimension list */}
        <div className="lg:col-span-2">
          <Card bodyClassName="px-3 py-3">
            {keys.map((k, i) => {
              const dim = dims[k];
              const m = TIER_META[dim.tier] ?? TIER_META.solid;
              return (
                <button
                  key={k}
                  onClick={() => setSel(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${sel === i ? 'bg-[#EEF0F8]' : 'hover:bg-[var(--bg-soft)]'}`}
                >
                  <span className="text-[11px] text-[var(--muted-2)] w-4 text-right shrink-0">{i + 1}</span>
                  <span className="text-[13px] font-medium text-[var(--ink)] w-44 shrink-0 leading-tight">{DIMENSION_LABELS[k]}</span>
                  <div className="flex-1 h-1.5 bg-[var(--bg-deep)] rounded-full overflow-hidden min-w-[40px]">
                    <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${m.pct}%` }} />
                  </div>
                  <span className={`text-[12px] font-semibold w-20 text-right shrink-0 ${m.text}`}>{m.label}</span>
                  <span className="hidden sm:inline"><ConfidenceDot level={CONF_LEVEL[dim.confidence] ?? 'Moderate'} /></span>
                  <span className="text-[11px] text-[var(--muted-2)] w-12 text-right shrink-0">{dim.evidence.length} ev.</span>
                </button>
              );
            })}
          </Card>
        </div>

        {/* Selected detail */}
        <div>
          <Card bodyClassName="px-6 py-5">
            <Eyebrow>Selected</Eyebrow>
            <h3 className="text-[16px] font-bold text-[var(--ink)] mb-2 mt-0.5">{DIMENSION_LABELS[selKey]}</h3>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Chip tone={dm.tone}>{dm.label}</Chip>
              <ConfidenceDot level={CONF_LEVEL[d.confidence] ?? 'Moderate'} />
            </div>
            <div className="flex flex-col gap-3 text-[13px]">
              <div>
                <Eyebrow>Reader interpretation</Eyebrow>
                <p className="text-[var(--ink)] leading-relaxed mt-0.5">{d.reader_interpretation}</p>
              </div>
              {d.evidence.length > 0 && (
                <div>
                  <Eyebrow>Evidence ({d.evidence.length})</Eyebrow>
                  <ul className="mt-1 flex flex-col gap-1">
                    {d.evidence.slice(0, 4).map((e, i) => <li key={i} className="text-[12.5px] text-[var(--ink)] leading-relaxed">• {e}</li>)}
                  </ul>
                </div>
              )}
              <div>
                <Eyebrow>Identified gaps</Eyebrow>
                <p className="text-[var(--muted)] mt-0.5 leading-relaxed">{d.missing.length ? d.missing.join('; ') : 'None material.'}</p>
              </div>
              <div>
                <Eyebrow>Overstatement risk</Eyebrow>
                <p className="text-[var(--muted)] mt-0.5">{OVERSTATE[d.overstatement_risk] ?? d.overstatement_risk}</p>
              </div>
            </div>
            <Link
              href={`/students/${studentId}/strategy`}
              className="mt-5 w-full inline-flex items-center justify-center py-2 text-[13px] font-semibold text-[var(--accent)] border border-[var(--accent-100)] rounded-lg hover:bg-[#EEF0F8] transition-colors"
            >
              View in full strategy
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
