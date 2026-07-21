'use client';

import type React from 'react';
import { ShieldCheck, Users, Lightbulb, AlertTriangle, ScrollText, History } from 'lucide-react';
import {
  CLAIM_STATUS_META,
  type Blueprint,
  type Claim,
  type ClaimStatus,
} from '@/lib/admissions/blueprint';
import type { FitLevel } from '@/lib/admissions/schoolMatch';

/* ── Qualitative fit pill — tier words only, never a score ── */
const FIT_PILL: Record<FitLevel, string> = {
  Excellent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Strong: 'bg-[var(--accent-50)] text-[var(--accent)] border-[var(--accent-100)]',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
  Limited: 'bg-red-50 text-red-600 border-red-200',
  Unknown: 'bg-slate-50 text-slate-500 border-slate-200',
};
function FitPill({ level }: { level: FitLevel }) {
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${FIT_PILL[level] ?? FIT_PILL.Unknown}`}>{level}</span>;
}

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
  const { executiveOverview: ov, identity: id, positioning: pos, futureSelf: fut, evidence: ev, programFit: pf, narrative: nar } = bp;
  const osLast = id.operatingSystem.length - 1;
  const gjLast = id.growthJourney.length - 1;
  const hasEvidence = ev.academicFoundation.length > 0 || ev.threePillars.length > 0 || ev.caseStudies.length > 0 || ev.rangeEvidence.length > 0;
  const hasProgramFit = pf.needs.length > 0 || pf.fitMatrix.length > 0 || pf.priorityPrograms.length > 0 || pf.roundStrategy.length > 0;
  const hasNarrative = !!nar.masterLine || nar.activitiesArchitecture.length > 0 || nar.commonAppDirections.length > 0;

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
        {bp.revisions && bp.revisions.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-[var(--accent-100)] flex items-center gap-2 flex-wrap">
            <History size={13} className="text-[var(--accent)]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">Revision history</span>
            {[...bp.revisions].reverse().map((r, i) => (
              <span key={i} className="text-[11.5px] text-[var(--muted)] bg-white/70 border border-[var(--accent-100)] rounded-full px-2 py-0.5">
                {r.draftLabel}
              </span>
            ))}
            <span className="text-[11.5px] font-semibold text-[var(--ink)] bg-white border border-[var(--accent)] rounded-full px-2 py-0.5">{bp.draftLabel} · current</span>
          </div>
        )}
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

      {/* Volume II — Evidence */}
      {hasEvidence && (
        <VolumeCard label="Volume II · Evidence" title="What is fact, and what is interpretation?" sub="Every major claim should touch at least one pillar. Individual contribution is separated from team outcome.">
          {ev.threePillars.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-3 mb-6">
              {ev.threePillars.map((p, i) => (
                <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-3.5 bg-[var(--bg-soft)]">
                  <div className="text-[13.5px] font-semibold text-[var(--ink)]">{p.pillar}</div>
                  <p className="text-[12px] text-[var(--muted)] leading-relaxed mt-0.5">{p.proves}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {p.primaryEvidence.map((e, j) => (
                      <li key={j} className="text-[12.5px] text-[var(--ink)] flex gap-1.5 leading-snug"><span className="text-[var(--accent)] shrink-0">·</span>{e}</li>
                    ))}
                  </ul>
                  {p.currentGap && <p className="text-[11.5px] text-red-600 mt-2 leading-relaxed">Gap: {p.currentGap}</p>}
                </div>
              ))}
            </div>
          )}

          {ev.academicFoundation.length > 0 && (
            <div className="mb-6">
              <Label>Academic foundation</Label>
              <div className="flex flex-col gap-2.5">
                {ev.academicFoundation.map((a, i) => (
                  <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[13.5px] font-semibold text-[var(--ink)]">{a.dimension}</span>
                      <ClaimStatusChip status={a.status} className="shrink-0" />
                    </div>
                    <p className="text-[13px] text-[var(--ink)] leading-relaxed">{a.evidence}</p>
                    <p className="text-[12px] text-[var(--muted)] leading-relaxed mt-1"><span className="font-semibold">Signals:</span> {a.strategicMeaning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ev.caseStudies.length > 0 && (
            <div className="mb-6">
              <Label>Project case studies</Label>
              <div className="flex flex-col gap-3.5">
                {ev.caseStudies.map((cs, i) => (
                  <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-4">
                    <div className="text-[14.5px] font-semibold text-[var(--ink)]">{cs.name}</div>
                    <p className="text-[12.5px] text-[var(--accent)] font-medium leading-relaxed mt-0.5">{cs.headline}</p>
                    <div className="flex flex-col gap-1.5 mt-3">
                      {cs.layers.map((l, j) => (
                        <div key={j} className="flex items-start gap-2.5">
                          <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--muted)] w-24 shrink-0 pt-0.5">{l.layer}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[12.5px] text-[var(--ink)] leading-relaxed">{l.evidence}</p>
                              <ClaimStatusChip status={l.status} className="shrink-0" />
                            </div>
                            <p className="text-[11.5px] text-[var(--muted)] leading-relaxed">{l.demonstrates}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {cs.strategicMeaning && (
                      <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed mt-3 pt-3 border-t border-[var(--line)]"><span className="font-semibold">Strategic meaning:</span> {cs.strategicMeaning}</p>
                    )}
                    {cs.verifyGaps.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {cs.verifyGaps.map((g, j) => <ClaimLine key={j} claim={g} />)}
                      </div>
                    )}
                    {cs.bestUses.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {cs.bestUses.map((u, j) => (
                          <span key={j} className="text-[11px] text-[var(--muted)] bg-[var(--bg-soft)] border border-[var(--line)] rounded-full px-2 py-0.5">
                            <span className="font-semibold text-[var(--ink-soft)]">{u.context}:</span> {u.angle}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ev.rangeEvidence.length > 0 && (
            <div>
              <Label>Range &amp; breadth</Label>
              <ScrollTable head={['Evidence', 'Signal', 'Use in application']}>
                {ev.rangeEvidence.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="py-3 pr-4 font-semibold text-[var(--ink)]">{r.evidence}</td>
                    <td className="py-3 pr-4 text-[var(--muted)] leading-relaxed">{r.signal}</td>
                    <td className="py-3 pr-4 text-[var(--ink)] leading-relaxed">{r.useInApplication}</td>
                  </tr>
                ))}
              </ScrollTable>
            </div>
          )}
        </VolumeCard>
      )}

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

      {/* Volume V — Program Fit */}
      {hasProgramFit && (
        <VolumeCard label="Volume V · Program Fit" title="Evaluate the program, not just the university" sub="Fit is a tier word, never a score or an admit rate. Numeric authority lives in the engine.">
          {pf.needs.length > 0 && (
            <div className="mb-5">
              <Label>What a strong program requires</Label>
              <ScrollTable head={['Criterion', 'Why it matters', 'Minimum acceptable']}>
                {pf.needs.map((n, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="py-3 pr-4 font-semibold text-[var(--ink)] whitespace-nowrap">{n.criterion}</td>
                    <td className="py-3 pr-4 text-[var(--muted)] leading-relaxed">{n.whyItMatters}</td>
                    <td className="py-3 pr-4 text-[var(--ink)] leading-relaxed">{n.minimumAcceptable}</td>
                  </tr>
                ))}
              </ScrollTable>
            </div>
          )}

          {pf.landscape.length > 0 && (
            <div className="mb-5">
              <Label>Academic-model landscape</Label>
              <div className="grid sm:grid-cols-3 gap-3">
                {pf.landscape.map((g, i) => (
                  <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-3.5 bg-[var(--bg-soft)]">
                    <div className="text-[13px] font-semibold text-[var(--ink)]">{g.model}</div>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {g.programs.map((p, j) => <li key={j} className="text-[12.5px] text-[var(--ink-soft)] leading-snug">{p}</li>)}
                    </ul>
                    {g.note && <p className="text-[11.5px] text-[var(--muted)] mt-2 leading-relaxed">{g.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pf.fitMatrix.length > 0 && (
            <div className="mb-5">
              <Label>Strategic fit matrix</Label>
              <ScrollTable head={['Program', 'Technical depth', 'Business integration', 'Product ecosystem', 'Current fit']}>
                {pf.fitMatrix.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="py-3 pr-4 font-semibold text-[var(--ink)]">{r.program}</td>
                    <td className="py-3 pr-4"><FitPill level={r.technicalDepth} /></td>
                    <td className="py-3 pr-4"><FitPill level={r.businessIntegration} /></td>
                    <td className="py-3 pr-4"><FitPill level={r.productEcosystem} /></td>
                    <td className="py-3 pr-4 text-[var(--ink)] font-medium leading-relaxed">{r.currentFit}</td>
                  </tr>
                ))}
              </ScrollTable>
            </div>
          )}

          {pf.priorityPrograms.length > 0 && (
            <div className="mb-5">
              <Label>Priority programs</Label>
              <div className="flex flex-col gap-3.5">
                {pf.priorityPrograms.map((p, i) => (
                  <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-4">
                    <div className="text-[14.5px] font-semibold text-[var(--ink)] mb-1.5">{p.name}</div>
                    <ClaimLine claim={p.whyThesis} />
                    {p.features.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-2 mt-3">
                        {p.features.map((f, j) => (
                          <div key={j} className="rounded-[8px] bg-[var(--bg-soft)] border border-[var(--line)] px-3 py-2">
                            <div className="text-[12.5px] font-semibold text-[var(--ink)]">{f.feature}</div>
                            <p className="text-[11.5px] text-emerald-700 leading-relaxed mt-0.5">Fit: {f.fit}</p>
                            <p className="text-[11.5px] text-amber-700 leading-relaxed">Caution: {f.caution}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.decisionTest && (
                      <p className="text-[12.5px] text-[var(--ink)] leading-relaxed mt-3 pt-3 border-t border-[var(--line)]"><span className="font-semibold">Decision test:</span> {p.decisionTest}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pf.roundStrategy.length > 0 && (
            <div className="mb-5">
              <Label>Round strategy</Label>
              <ScrollTable head={['Round', 'School / program', 'Recommendation', 'Condition']}>
                {pf.roundStrategy.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="py-3 pr-4 font-semibold text-[var(--accent)] whitespace-nowrap">{r.round}</td>
                    <td className="py-3 pr-4 font-medium text-[var(--ink)]">{r.schoolOrProgram}</td>
                    <td className="py-3 pr-4 text-[var(--ink)] leading-relaxed">{r.recommendation}</td>
                    <td className="py-3 pr-4 text-[var(--muted)] leading-relaxed">{r.condition}</td>
                  </tr>
                ))}
              </ScrollTable>
            </div>
          )}

          {pf.bindingPrinciple && (
            <Callout tone="red" label="Binding principle">{pf.bindingPrinciple}</Callout>
          )}
        </VolumeCard>
      )}

      {/* Volume VI — Narrative System */}
      {hasNarrative && (
        <VolumeCard label="Volume VI · Narrative System" title="One core narrative, many expressions" sub="A single stable story with school-specific emphases — never contradictory identities for different schools.">
          {nar.masterLine && (
            <div className="mb-5">
              <Callout tone="accent" label="Master line">{nar.masterLine}</Callout>
            </div>
          )}

          {nar.schoolEmphasis.length > 0 && (
            <div className="mb-5">
              <Label>School-specific emphasis</Label>
              <ScrollTable head={['Context', 'Emphasis', 'Core question it answers']}>
                {nar.schoolEmphasis.map((s, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="py-3 pr-4 font-semibold text-[var(--ink)] whitespace-nowrap">{s.context}</td>
                    <td className="py-3 pr-4 text-[var(--ink)] leading-relaxed">{s.emphasis}</td>
                    <td className="py-3 pr-4 text-[var(--muted)] italic leading-relaxed">{s.coreQuestion}</td>
                  </tr>
                ))}
              </ScrollTable>
            </div>
          )}

          {nar.commonAppDirections.length > 0 && (
            <div className="mb-5">
              <Label>Common App essay directions to test</Label>
              <div className="flex flex-col gap-2.5">
                {nar.commonAppDirections.map((d, i) => (
                  <div key={i} className="border border-[var(--line)] rounded-[10px] px-4 py-3.5">
                    <div className="text-[13.5px] font-semibold text-[var(--ink)]">{d.direction}</div>
                    <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed mt-1"><span className="font-semibold">Possible scene:</span> {d.possibleScene}</p>
                    <div className="grid sm:grid-cols-2 gap-2.5 mt-2">
                      <p className="text-[12px] text-emerald-700 leading-relaxed">Reveals: {d.reveals}</p>
                      <p className="text-[12px] text-amber-700 leading-relaxed">Risk: {d.risk}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nar.activitiesArchitecture.length > 0 && (
            <div className="mb-5">
              <Label>Activities architecture</Label>
              <div className="flex flex-col gap-2">
                {[...nar.activitiesArchitecture].sort((a, b) => a.priority - b.priority).map((a, i) => (
                  <div key={i} className="flex items-start gap-3 border border-[var(--line)] rounded-[10px] px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-50)] text-[var(--accent)] text-[12px] font-bold flex items-center justify-center shrink-0">{a.priority}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13.5px] font-semibold text-[var(--ink)]">{a.activity} <span className="text-[var(--muted)] font-normal">— {a.role}</span></span>
                        <ClaimStatusChip status={a.status} className="shrink-0" />
                      </div>
                      <p className="text-[12.5px] text-[var(--ink-soft)] leading-relaxed mt-0.5"><span className="font-semibold">Signal:</span> {a.primarySignal}</p>
                      {a.neededBeforeFinal && <p className="text-[11.5px] text-[var(--muted)] italic leading-relaxed mt-0.5">→ {a.neededBeforeFinal}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nar.resumeHeadline && (
            <div className="mb-5">
              <Label>Resume headline</Label>
              <p className="text-[14px] font-medium text-[var(--ink)] leading-relaxed">{nar.resumeHeadline}</p>
            </div>
          )}

          {nar.recommendations.length > 0 && (
            <div className="mb-5">
              <Label>Recommendation plan</Label>
              <ScrollTable head={['Source', 'Should establish', 'Evidence to provide']}>
                {nar.recommendations.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="py-3 pr-4 font-semibold text-[var(--ink)] whitespace-nowrap">{r.source}</td>
                    <td className="py-3 pr-4 text-[var(--ink)] leading-relaxed">{r.shouldEstablish}</td>
                    <td className="py-3 pr-4 text-[var(--muted)] leading-relaxed">{r.evidenceToProvide}</td>
                  </tr>
                ))}
              </ScrollTable>
            </div>
          )}

          {nar.interviewStoryBank.length > 0 && (
            <div>
              <Label>Interview story bank</Label>
              <ul className="flex flex-col gap-2">
                {nar.interviewStoryBank.map((s, i) => (
                  <li key={i} className="text-[13px] text-[var(--ink)] flex gap-2 leading-relaxed"><span className="text-[var(--accent)] shrink-0">·</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </VolumeCard>
      )}

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
