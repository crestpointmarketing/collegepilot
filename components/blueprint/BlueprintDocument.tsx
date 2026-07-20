'use client';

import type React from 'react';
import { ShieldCheck, Users, Lightbulb, AlertTriangle, ScrollText } from 'lucide-react';
import {
  CLAIM_STATUS_META,
  type Blueprint,
  type Claim,
  type ClaimStatus,
} from '@/lib/admissions/blueprint';

/* ── Honesty chip — matches the app's emerald/amber/red confidence language ── */

const CLAIM_STATUS_CHIP: Record<ClaimStatus, { cls: string; Icon: typeof ShieldCheck }> = {
  confirmed:          { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ShieldCheck },
  family_confirmed:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: Users },
  working_hypothesis: { cls: 'bg-blue-50 text-blue-700 border-blue-200',          Icon: Lightbulb },
  verify:             { cls: 'bg-red-50 text-red-600 border-red-200',             Icon: AlertTriangle },
};

export function ClaimStatusChip({ status, className = '' }: { status: ClaimStatus; className?: string }) {
  const meta = CLAIM_STATUS_CHIP[status];
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${meta.cls} ${className}`}
      title={CLAIM_STATUS_META[status].description}
    >
      <Icon size={11} />{CLAIM_STATUS_META[status].label}
    </span>
  );
}

/** A labeled statement: prose (wraps freely) + status chip + the next action if unverified. */
function ClaimLine({ claim }: { claim: Claim }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13.5px] text-[var(--ink)] leading-relaxed flex-1 min-w-0">{claim.text}</p>
        <ClaimStatusChip status={claim.status} className="mt-0.5 shrink-0" />
      </div>
      {claim.verifyAction && claim.status !== 'confirmed' && (
        <p className="text-[12.5px] text-[var(--muted)] italic mt-1.5 leading-relaxed">→ {claim.verifyAction}</p>
      )}
      {claim.source && (
        <p className="text-[11.5px] text-[var(--muted-2)] mt-1">Source: {claim.source}</p>
      )}
    </div>
  );
}

/* ── Layout primitives ── */

function VolumeCard({ label, title, sub, children }: {
  label: string; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-7 pt-5 pb-4 border-b border-[var(--line)]">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">{label}</div>
        <h2 className="text-[19px] font-semibold text-[var(--ink)] tracking-tight mt-1.5">{title}</h2>
        {sub && <p className="text-[13.5px] text-[var(--muted)] mt-1 leading-relaxed">{sub}</p>}
      </div>
      <div className="px-7 pt-5 pb-6">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-2">{children}</div>;
}

function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="py-3.5 border-b border-[var(--line)] last:border-0 last:pb-0 first:pt-0">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">{label}</div>
      <p className="text-[14px] text-[var(--ink)] leading-relaxed">{value}</p>
    </div>
  );
}

function Callout({ tone, label, children }: { tone: 'red' | 'accent'; label: string; children: React.ReactNode }) {
  const box = tone === 'red' ? 'bg-red-50 border-red-200' : 'bg-[var(--accent-50)] border-[var(--accent-100)]';
  const lab = tone === 'red' ? 'text-red-600' : 'text-[var(--accent)]';
  return (
    <div className={`rounded-[10px] border px-[18px] py-[15px] ${box}`}>
      <div className={`text-[10.5px] font-bold uppercase tracking-[0.1em] mb-1.5 ${lab}`}>{label}</div>
      <div className="text-[13.5px] text-[var(--ink)] leading-relaxed">{children}</div>
    </div>
  );
}

function ScrollTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[13.5px] min-w-[520px]">
        <thead>
          <tr className="text-left border-b border-[var(--line)]">
            {head.map((h, i) => (
              <th key={i} className="py-2.5 pr-4 font-bold text-[10.5px] uppercase tracking-[0.08em] text-[var(--muted)] align-bottom">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ── Document ── */

export function BlueprintDocument({ blueprint: bp }: { blueprint: Blueprint }) {
  const { executiveOverview: ov, identity: id, positioning: pos, futureSelf: fut } = bp;
  const osLast = id.operatingSystem.length - 1;
  const gjLast = id.growthJourney.length - 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Cover */}
      <div className="rounded-card border border-[var(--accent-100)] px-7 py-7" style={{ background: 'var(--accent-50)' }}>
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <ScrollText size={15} />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em]">Blueprint · {bp.draftLabel} · Working Draft</span>
        </div>
        <h1 className="text-[28px] font-semibold text-[var(--ink)] tracking-tight mt-2.5">{id.coreIdentity || bp.studentName}</h1>
        <p className="text-[16px] text-[var(--ink-soft)] mt-2.5 max-w-2xl leading-relaxed">{bp.thesis}</p>
        <p className="text-[12.5px] text-[var(--muted)] mt-3.5 italic max-w-2xl leading-relaxed">
          Designing the person before designing the application. Every claim below carries an evidence label — nothing marked “Verify” should enter an application unchanged.
        </p>
      </div>

      {/* Executive overview */}
      <VolumeCard label="Executive Overview" title="The strategy in one page">
        <FieldRow label="Core Identity" value={ov.coreIdentity} />
        <FieldRow label="Primary Narrative" value={ov.primaryNarrative} />
        <FieldRow label="Best-fit Academic Model" value={ov.bestFitModel} />
        <FieldRow label="Current Early Recommendation" value={ov.currentEarlyRecommendation} />
        {ov.guardrail && (
          <div className="mt-4.5 pt-1">
            <Callout tone="red" label="Guardrail · biggest strategic risk">{ov.guardrail}</Callout>
          </div>
        )}
      </VolumeCard>

      {/* Volume I — Identity */}
      <VolumeCard label="Volume I · Identity" title={`Who is ${bp.studentName.split(' ')[0]}?`} sub="The internal anchor. School-specific language adapts; this logic stays stable.">
        <div className="grid sm:grid-cols-2 gap-3.5 mb-6">
          <div className="border border-[var(--line)] rounded-[10px] px-[18px] py-4 bg-[var(--bg-soft)]">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Core Identity</div>
            <div className="text-[17px] font-semibold text-[var(--ink)] tracking-tight mt-1">{id.coreIdentity}</div>
          </div>
          <div className="border border-[var(--line)] rounded-[10px] px-[18px] py-4 bg-[var(--bg-soft)]">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Distinctive Capability</div>
            <div className="text-[17px] font-semibold text-[var(--ink)] tracking-tight mt-1">{id.distinctiveCapability}</div>
          </div>
        </div>

        <Label>Positioning Statement</Label>
        <div className="border-l-[3px] border-[var(--accent)] rounded-r-[10px] px-[18px] py-4" style={{ background: 'var(--accent-50)' }}>
          <ClaimLine claim={id.positioningStatement} />
        </div>
        {id.firstPersonDraft && (
          <p className="text-[13.5px] text-[var(--ink-soft)] italic mt-3 leading-relaxed">
            First-person draft ({bp.studentName.split(' ')[0]} must edit): “{id.firstPersonDraft}”
          </p>
        )}

        <div className="mt-6">
          <FieldRow label="Intrinsic Motivation" value={id.intrinsicMotivation} />
          <FieldRow label="Craft" value={id.craft} />
          <FieldRow label="Purpose" value={id.purpose} />
        </div>

        {id.avoids.length > 0 && (
          <div className="mt-6">
            <Label>What this identity avoids claiming</Label>
            <ul className="flex flex-col gap-2">
              {id.avoids.map((a, i) => (
                <li key={i} className="text-[13.5px] text-[var(--muted)] flex gap-2 leading-relaxed">
                  <span className="text-[var(--muted-2)] shrink-0">✕</span><span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {id.operatingSystem.length > 0 && (
          <div className="mt-7">
            <Label>Operating System</Label>
            <div>
              {id.operatingSystem.map((s, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-[34px] h-[34px] rounded-full bg-[var(--accent-50)] text-[var(--accent)] font-bold text-[13px] flex items-center justify-center">{i + 1}</div>
                    {i < osLast && <div className="w-0.5 flex-1 bg-[var(--line)] my-1.5 min-h-[14px]" />}
                  </div>
                  <div className={`flex-1 min-w-0 ${i < osLast ? 'pb-5' : ''}`}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">{s.stage}</div>
                    <p className="text-[14px] text-[var(--ink)] leading-relaxed mt-0.5">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {id.brandDna.length > 0 && (
          <div className="mt-7">
            <Label>Brand DNA · traits that recur across the evidence</Label>
            <div className="flex flex-col gap-3">
              {id.brandDna.map((t, i) => (
                <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-3.5">
                  <div className="flex items-baseline gap-2.5 flex-wrap mb-1.5">
                    <span className="text-[14px] font-semibold text-[var(--ink)]">{t.trait}</span>
                    <span className="text-[12.5px] text-[var(--muted)] italic">{t.internalQuestion}</span>
                  </div>
                  <ClaimLine claim={t.evidence} />
                </div>
              ))}
            </div>
          </div>
        )}

        {id.growthJourney.length > 0 && (
          <div className="mt-7">
            <Label>Growth Journey</Label>
            <div>
              {id.growthJourney.map((g, i) => (
                <div key={i} className="flex gap-3.5">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-[11px] h-[11px] rounded-full bg-[var(--accent)] mt-1.5" />
                    {i < gjLast && <div className="w-0.5 flex-1 bg-[var(--line)] my-1 min-h-[10px]" />}
                  </div>
                  <div className={`flex-1 min-w-0 ${i < gjLast ? 'pb-4' : ''}`}>
                    <div className="text-[14px] font-semibold text-[var(--ink)]">{g.label}</div>
                    <p className="text-[13px] text-[var(--muted)] leading-relaxed mt-0.5">{g.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </VolumeCard>

      {/* Volume III — Positioning */}
      <VolumeCard label="Volume III · Positioning" title={`How ${bp.studentName.split(' ')[0]} differs from the ${pos.archetypeLabel || 'typical applicant'}`} sub="Differentiation without overstating evidence — including risks and tradeoffs.">
        {pos.archetypeComparison.length > 0 && (
          <div className="mb-5">
            <ScrollTable head={['Dimension', 'Typical profile', 'This student']}>
              {pos.archetypeComparison.map((r, i) => (
                <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                  <td className="py-3 pr-4 font-semibold text-[var(--ink)] whitespace-nowrap">{r.dimension}</td>
                  <td className="py-3 pr-4 text-[var(--muted)] leading-relaxed">{r.typicalProfile}</td>
                  <td className="py-3 pr-4 text-[var(--ink)] leading-relaxed">{r.thisStudent}</td>
                </tr>
              ))}
            </ScrollTable>
          </div>
        )}

        {pos.positioningDecision && (
          <div className="mb-5">
            <Callout tone="accent" label="Positioning decision">{pos.positioningDecision}</Callout>
          </div>
        )}

        {pos.strengthsGapsRisks.length > 0 && (
          <div className="mb-5">
            <Label>Strengths, gaps &amp; avoidable risks</Label>
            <div className="flex flex-col gap-3">
              {pos.strengthsGapsRisks.map((r, i) => (
                <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="text-[14px] font-semibold text-[var(--ink)]">{r.area}</span>
                    <ClaimStatusChip status={r.status} className="shrink-0" />
                  </div>
                  <p className="text-[13.5px] text-[var(--ink)] leading-relaxed">{r.assessment}</p>
                  <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-red-600">Risk</div>
                      <p className="text-[13px] text-[var(--ink)] leading-relaxed mt-0.5">{r.risk}</p>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-emerald-700">Action</div>
                      <p className="text-[13px] text-[var(--ink)] leading-relaxed mt-0.5">{r.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pos.mostImportantRisk.risk && (
          <Callout tone="red" label="Most important risk">
            <p><span className="font-semibold">Avoid:</span> {pos.mostImportantRisk.risk}</p>
            <p className="mt-1.5"><span className="font-semibold text-emerald-700">Stronger message:</span> {pos.mostImportantRisk.strongerMessage}</p>
          </Callout>
        )}
      </VolumeCard>

      {/* Volume IV — Future Self */}
      <VolumeCard label="Volume IV · Future Self" title="A direction to test — not a prediction to perform" sub={fut.futureIdentity}>
        <div className="grid sm:grid-cols-2 gap-5 mb-6">
          <div>
            <Label>Plausible directions</Label>
            <div className="flex flex-col gap-2.5">
              {fut.plausibleDirections.map((d, i) => (
                <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-3">
                  <div className="text-[13.5px] font-semibold text-[var(--ink)]">{d.title}</div>
                  <p className="text-[12.5px] text-[var(--muted)] leading-relaxed mt-1">{d.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Not the current center</Label>
            <div className="flex flex-col gap-2.5">
              {fut.notTheCenter.map((d, i) => (
                <div key={i} className="border border-dashed border-[var(--line-strong)] rounded-[10px] px-4 py-3">
                  <div className="text-[13.5px] font-semibold text-[var(--muted)]">{d.title}</div>
                  <p className="text-[12.5px] text-[var(--muted-2)] leading-relaxed mt-1">{d.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {fut.learningAgenda.length > 0 && (
          <div>
            <Label>Ten-year learning agenda</Label>
            <ScrollTable head={['Capability', 'Undergraduate goal', 'Evidence by graduation']}>
              {fut.learningAgenda.map((c, i) => (
                <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                  <td className="py-3 pr-4 font-semibold text-[var(--ink)] whitespace-nowrap">{c.capability}</td>
                  <td className="py-3 pr-4 text-[var(--muted)] leading-relaxed">{c.undergraduateGoal}</td>
                  <td className="py-3 pr-4 text-[var(--ink)] leading-relaxed">{c.evidenceByGraduation}</td>
                </tr>
              ))}
            </ScrollTable>
          </div>
        )}
      </VolumeCard>

      {/* Master Claim Register */}
      {bp.claimRegister.length > 0 && (
        <VolumeCard label="Verification" title="Master claim register" sub="Every statement not yet Confirmed, auto-collected. Resolve before anything enters an application.">
          <div className="flex flex-col">
            {bp.claimRegister.map((e, i) => (
              <div key={i} className="flex items-start gap-3 py-3 border-b border-[var(--line)] last:border-0 first:pt-0">
                <ClaimStatusChip status={e.status} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] text-[var(--ink)] leading-relaxed">{e.claim}</p>
                  <p className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">{e.location} · <span className="italic">{e.requiredAction}</span></p>
                </div>
              </div>
            ))}
          </div>
        </VolumeCard>
      )}

      {/* Family review + 30-day plan */}
      <div className="grid md:grid-cols-2 gap-4">
        {bp.familyReviewQuestions.length > 0 && (
          <VolumeCard label="Family Review" title={`Questions for ${bp.studentName.split(' ')[0]}`}>
            <ol className="flex flex-col gap-2.5 list-decimal pl-5">
              {bp.familyReviewQuestions.map((q, i) => (
                <li key={i} className="text-[13.5px] text-[var(--ink)] leading-relaxed pl-1">{q}</li>
              ))}
            </ol>
          </VolumeCard>
        )}
        {bp.next30Days.length > 0 && (
          <VolumeCard label="Execution" title="The next 30 days">
            <div className="flex flex-col gap-3.5">
              {bp.next30Days.map((m, i) => (
                <div key={i} className="flex gap-3.5">
                  <div className="text-[11px] font-bold text-[var(--accent)] w-14 shrink-0 pt-0.5">Week {m.when}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-[var(--ink)]">{m.priority}</div>
                    <p className="text-[12.5px] text-[var(--muted)] leading-relaxed mt-0.5">{m.deliverable}</p>
                  </div>
                </div>
              ))}
            </div>
          </VolumeCard>
        )}
      </div>
    </div>
  );
}
