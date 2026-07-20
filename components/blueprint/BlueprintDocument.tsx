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
      className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded border ${meta.cls} ${className}`}
      title={CLAIM_STATUS_META[status].description}
    >
      <Icon size={10} />{CLAIM_STATUS_META[status].label}
    </span>
  );
}

/** A single labeled statement: prose + status chip + (if unverified) the next action. */
function ClaimLine({ claim }: { claim: Claim }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <p className="text-[13.5px] text-[var(--ink)] leading-relaxed flex-1">{claim.text}</p>
        <ClaimStatusChip status={claim.status} className="mt-0.5 shrink-0" />
      </div>
      {claim.verifyAction && claim.status !== 'confirmed' && (
        <p className="text-[12px] text-[var(--muted)] italic">→ {claim.verifyAction}</p>
      )}
      {claim.source && (
        <p className="text-[11.5px] text-[var(--muted-2)]">Source: {claim.source}</p>
      )}
    </div>
  );
}

/* ── Layout primitives (mirror strategy/page StratCard + tokens) ── */

function VolumeCard({ label, title, sub, children }: {
  label: string; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="px-6 py-3.5 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">{label}</span>
        </div>
        <h2 className="text-[17px] font-semibold text-[var(--ink)] mt-1">{title}</h2>
        {sub && <p className="text-[13px] text-[var(--muted)] mt-0.5">{sub}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="py-2.5 border-b border-[var(--line)] last:border-0">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">{label}</div>
      <p className="text-[13.5px] text-[var(--ink)] leading-relaxed">{value}</p>
    </div>
  );
}

function SubTile({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] p-4">{children}</div>;
}

/* ── The document ── */

export function BlueprintDocument({ blueprint: bp }: { blueprint: Blueprint }) {
  const { executiveOverview: ov, identity: id, positioning: pos, futureSelf: fut } = bp;

  return (
    <div className="flex flex-col gap-4">
      {/* Cover / thesis */}
      <div className="rounded-card overflow-hidden border border-[var(--accent-100)]" style={{ background: 'var(--accent-50)' }}>
        <div className="px-6 py-6">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <ScrollText size={16} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Blueprint · {bp.draftLabel} · Working Draft</span>
          </div>
          <h1 className="text-[26px] font-semibold text-[var(--ink)] tracking-tight mt-2">{id.coreIdentity || bp.studentName}</h1>
          <p className="text-[15px] text-[var(--ink-soft)] mt-2 max-w-2xl leading-relaxed">{bp.thesis}</p>
          <p className="text-[12px] text-[var(--muted)] mt-3 italic">Designing the person before designing the application. Every claim below carries an evidence label — nothing marked “Verify” should enter an application unchanged.</p>
        </div>
      </div>

      {/* Executive overview */}
      <VolumeCard label="Executive Overview" title="The strategy in one page">
        <div className="grid gap-0">
          <FieldRow label="Core Identity" value={ov.coreIdentity} />
          <FieldRow label="Primary Narrative" value={ov.primaryNarrative} />
          <FieldRow label="Best-fit Academic Model" value={ov.bestFitModel} />
          <FieldRow label="Current Early Recommendation" value={ov.currentEarlyRecommendation} />
        </div>
        {ov.guardrail && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">Guardrail · biggest strategic risk</div>
            <p className="text-[13px] text-[var(--ink)] leading-relaxed">{ov.guardrail}</p>
          </div>
        )}
      </VolumeCard>

      {/* Volume I — Identity */}
      <VolumeCard label="Volume I · Identity" title="Who is this student?" sub="The internal anchor. School-specific language adapts; this logic stays stable.">
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <SubTile>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">Core Identity</div>
            <p className="text-[15px] font-semibold text-[var(--ink)]">{id.coreIdentity}</p>
          </SubTile>
          <SubTile>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-1">Distinctive Capability</div>
            <p className="text-[15px] font-semibold text-[var(--ink)]">{id.distinctiveCapability}</p>
          </SubTile>
        </div>

        <div className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Positioning Statement</div>
          <SubTile><ClaimLine claim={id.positioningStatement} /></SubTile>
          {id.firstPersonDraft && (
            <p className="text-[13px] text-[var(--ink-soft)] italic mt-2 leading-relaxed">
              First-person draft (student must edit): “{id.firstPersonDraft}”
            </p>
          )}
        </div>

        <div className="grid gap-0 mb-4">
          <FieldRow label="Intrinsic Motivation" value={id.intrinsicMotivation} />
          <FieldRow label="Craft" value={id.craft} />
          <FieldRow label="Purpose" value={id.purpose} />
        </div>

        {id.avoids.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">What this identity avoids claiming</div>
            <ul className="flex flex-col gap-1.5">
              {id.avoids.map((a, i) => (
                <li key={i} className="text-[13px] text-[var(--ink)] flex gap-2"><span className="text-[var(--muted-2)]">✕</span>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {id.operatingSystem.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Operating System</div>
            <div className="flex flex-wrap items-stretch gap-2">
              {id.operatingSystem.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <SubTile>
                    <div className="text-[11px] font-bold text-[var(--accent)]">{s.stage}</div>
                    <p className="text-[12.5px] text-[var(--ink)] mt-0.5 max-w-[200px]">{s.description}</p>
                  </SubTile>
                  {i < id.operatingSystem.length - 1 && <span className="text-[var(--muted-2)]">→</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {id.brandDna.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Brand DNA · traits that recur across the evidence</div>
            <div className="flex flex-col gap-2">
              {id.brandDna.map((t, i) => (
                <SubTile key={i}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-[var(--ink)]">{t.trait}</span>
                    <span className="text-[12px] text-[var(--muted)] italic">{t.internalQuestion}</span>
                  </div>
                  <ClaimLine claim={t.evidence} />
                </SubTile>
              ))}
            </div>
          </div>
        )}

        {id.growthJourney.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Growth Journey</div>
            <div className="flex flex-col gap-2">
              {id.growthJourney.map((g, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--accent-50)] text-[var(--accent)] flex items-center justify-center text-[11px] font-bold shrink-0">{i + 1}</div>
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--ink)]">{g.label}</div>
                    <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">{g.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </VolumeCard>

      {/* Volume III — Positioning */}
      <VolumeCard label="Volume III · Positioning" title={`How this student differs from the ${pos.archetypeLabel || 'typical applicant'}`} sub="Differentiation without overstating evidence — including risks and tradeoffs.">
        {pos.archetypeComparison.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] border-b border-[var(--line)]">
                  <th className="py-2 pr-3 font-semibold">Dimension</th>
                  <th className="py-2 pr-3 font-semibold">Typical profile</th>
                  <th className="py-2 font-semibold">This student</th>
                </tr>
              </thead>
              <tbody>
                {pos.archetypeComparison.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="py-2.5 pr-3 font-semibold text-[var(--ink)]">{r.dimension}</td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">{r.typicalProfile}</td>
                    <td className="py-2.5 text-[var(--ink)]">{r.thisStudent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pos.positioningDecision && (
          <div className="rounded-lg bg-[var(--accent-50)] border border-[var(--accent-100)] px-4 py-3 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] mb-1">Positioning decision</div>
            <p className="text-[13.5px] text-[var(--ink)] leading-relaxed">{pos.positioningDecision}</p>
          </div>
        )}

        {pos.strengthsGapsRisks.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Strengths, gaps & avoidable risks</div>
            {pos.strengthsGapsRisks.map((r, i) => (
              <SubTile key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-[var(--ink)]">{r.area}</span>
                  <ClaimStatusChip status={r.status} />
                </div>
                <p className="text-[12.5px] text-[var(--ink)] leading-relaxed">{r.assessment}</p>
                <div className="grid md:grid-cols-2 gap-2 mt-2">
                  <p className="text-[12px] text-red-600"><span className="font-semibold">Risk:</span> {r.risk}</p>
                  <p className="text-[12px] text-emerald-700"><span className="font-semibold">Action:</span> {r.action}</p>
                </div>
              </SubTile>
            ))}
          </div>
        )}

        {pos.mostImportantRisk.risk && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">Most important risk</div>
            <p className="text-[13px] text-[var(--ink)] leading-relaxed"><span className="font-semibold">Avoid:</span> {pos.mostImportantRisk.risk}</p>
            <p className="text-[13px] text-[var(--ink)] leading-relaxed mt-1"><span className="font-semibold text-emerald-700">Stronger message:</span> {pos.mostImportantRisk.strongerMessage}</p>
          </div>
        )}
      </VolumeCard>

      {/* Volume IV — Future Self */}
      <VolumeCard label="Volume IV · Future Self" title="A direction to test — not a prediction to perform" sub={fut.futureIdentity}>
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Plausible directions</div>
            <div className="flex flex-col gap-2">
              {fut.plausibleDirections.map((d, i) => (
                <SubTile key={i}>
                  <div className="text-[13px] font-semibold text-[var(--ink)]">{d.title}</div>
                  <p className="text-[12.5px] text-[var(--muted)] mt-0.5 leading-relaxed">{d.description}</p>
                </SubTile>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Not the current center</div>
            <div className="flex flex-col gap-2">
              {fut.notTheCenter.map((d, i) => (
                <div key={i} className="rounded-lg border border-dashed border-[var(--line-strong)] p-3">
                  <div className="text-[13px] font-semibold text-[var(--muted)]">{d.title}</div>
                  <p className="text-[12.5px] text-[var(--muted-2)] mt-0.5 leading-relaxed">{d.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {fut.learningAgenda.length > 0 && (
          <div className="overflow-x-auto">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">Ten-year learning agenda</div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)] border-b border-[var(--line)]">
                  <th className="py-2 pr-3">Capability</th>
                  <th className="py-2 pr-3">Undergraduate goal</th>
                  <th className="py-2">Evidence by graduation</th>
                </tr>
              </thead>
              <tbody>
                {fut.learningAgenda.map((c, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="py-2.5 pr-3 font-semibold text-[var(--ink)]">{c.capability}</td>
                    <td className="py-2.5 pr-3 text-[var(--muted)]">{c.undergraduateGoal}</td>
                    <td className="py-2.5 text-[var(--ink)]">{c.evidenceByGraduation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </VolumeCard>

      {/* Master Claim Register */}
      {bp.claimRegister.length > 0 && (
        <VolumeCard label="Verification" title="Master claim register" sub="Every statement not yet Confirmed, auto-collected. Resolve before anything enters an application.">
          <div className="flex flex-col gap-2">
            {bp.claimRegister.map((e, i) => (
              <div key={i} className="flex items-start gap-2 py-2 border-b border-[var(--line)] last:border-0">
                <ClaimStatusChip status={e.status} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[13px] text-[var(--ink)]">{e.claim}</p>
                  <p className="text-[12px] text-[var(--muted)]">{e.location} · <span className="italic">{e.requiredAction}</span></p>
                </div>
              </div>
            ))}
          </div>
        </VolumeCard>
      )}

      {/* Family review + 30-day plan */}
      <div className="grid md:grid-cols-2 gap-4">
        {bp.familyReviewQuestions.length > 0 && (
          <VolumeCard label="Family Review" title="Questions for the student">
            <ol className="flex flex-col gap-2 list-decimal list-inside">
              {bp.familyReviewQuestions.map((q, i) => (
                <li key={i} className="text-[13px] text-[var(--ink)] leading-relaxed">{q}</li>
              ))}
            </ol>
          </VolumeCard>
        )}
        {bp.next30Days.length > 0 && (
          <VolumeCard label="Execution" title="The next 30 days">
            <div className="flex flex-col gap-2">
              {bp.next30Days.map((m, i) => (
                <div key={i} className="flex gap-3">
                  <div className="text-[11px] font-bold text-[var(--accent)] w-14 shrink-0">Week {m.when}</div>
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--ink)]">{m.priority}</div>
                    <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">{m.deliverable}</p>
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
