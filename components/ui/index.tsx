'use client';

import type React from 'react';
import { Info, Zap, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

/**
 * Shared UI primitives — the single source of truth for the platform's visual
 * language. Values match the Figma "warm-ripple" design standard exactly.
 *
 * Palette (tokens in globals.css): ground #F8F7F4 · ink #1B2033 · muted #64748B
 * · accent indigo #4F46E5 · card white + rgba(27,32,51,.08) border, 12px radius.
 * Type: h1 26/bold · card title 15/semibold · eyebrow 10.5/bold/upper.
 */

/* ── Semantic tone — one color vocabulary (exact Figma hex) ── */
export type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'critical' | 'info';

export const CHIP_TONE: Record<Tone, string> = {
  neutral:  'bg-[#F1F2F5] text-[#4B5563]',
  accent:   'bg-[#EEF2FF] text-[#4F46E5]',
  positive: 'bg-[#DCFCE7] text-[#15803D]',
  warning:  'bg-[#FEF3C7] text-[#B45309]',
  critical: 'bg-[#FEE2E2] text-[#B91C1C]',
  info:     'bg-[#DBEAFE] text-[#1D4ED8]',
};

export function Chip({ tone = 'neutral', icon, children, className = '' }: {
  tone?: Tone; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap ${CHIP_TONE[tone]} ${className}`}>
      {icon}{children}
    </span>
  );
}

/* Evidence + AI status chips are thin wrappers over Chip (Figma spec). */
export type EvidenceLabelStatus = 'confirmed' | 'provided' | 'planned' | 'needs-verification' | 'self-reported' | 'externally-verified';
const EVIDENCE_LABEL: Record<EvidenceLabelStatus, { tone: Tone; label: string }> = {
  confirmed: { tone: 'positive', label: 'Confirmed' },
  provided: { tone: 'accent', label: 'Provided' },
  planned: { tone: 'neutral', label: 'Planned' },
  'needs-verification': { tone: 'warning', label: 'Needs Verification' },
  'self-reported': { tone: 'neutral', label: 'Self-Reported' },
  'externally-verified': { tone: 'positive', label: 'Externally Verified' },
};
export function EvidenceLabel({ status }: { status: EvidenceLabelStatus }) {
  const m = EVIDENCE_LABEL[status];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

export type AILabelType = 'ai-interpretation' | 'student-validated' | 'counselor-reviewed' | 'objective-fact' | 'missing-evidence';
const AI_LABEL: Record<AILabelType, { tone: Tone; label: string }> = {
  'ai-interpretation': { tone: 'accent', label: 'AI Interpretation' },
  'student-validated': { tone: 'positive', label: 'Student Validated' },
  'counselor-reviewed': { tone: 'info', label: 'Counselor Reviewed' },
  'objective-fact': { tone: 'neutral', label: 'Objective Fact' },
  'missing-evidence': { tone: 'warning', label: 'Missing Evidence' },
};
export function AILabel({ type }: { type: AILabelType }) {
  const m = AI_LABEL[type];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

/* ── Confidence dot ── */
export type ConfidenceLevel = 'High' | 'Moderate' | 'Low';
export function ConfidenceDot({ level }: { level: ConfidenceLevel }) {
  const c: Record<ConfidenceLevel, string> = { High: 'bg-[#16A34A]', Moderate: 'bg-[#D97706]', Low: 'bg-[#DC2626]' };
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
      <span className={`w-2 h-2 rounded-full shrink-0 ${c[level]}`} />{level}
    </span>
  );
}

/* ── Page header ── */
export function PageHeader({ title, sub, actions }: {
  title: string; sub?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h1 className="text-[26px] font-bold text-[var(--ink)] leading-tight tracking-tight">{title}</h1>
        {sub && <p className="text-[14px] text-[var(--muted)] mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}

/* ── Eyebrow label ── */
export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)] ${className}`}>{children}</div>;
}

/* ── Card — the canonical section container ── */
export function Card({ eyebrow, title, sub, icon, actions, tone, children, className = '', bodyClassName = 'px-6 py-5' }: {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const hasHeader = eyebrow || title || actions;
  const headTint = tone === 'critical' ? 'bg-[#FEE2E2]/40 border-[#FECACA]'
    : tone === 'warning' ? 'bg-[#FEF3C7]/40 border-[#FDE68A]'
    : 'border-[var(--line)]';
  return (
    <section className={`bg-white rounded-card shadow-card border border-[var(--line)] overflow-hidden ${className}`}>
      {hasHeader && (
        <div className={`px-6 pt-4 pb-3.5 border-b flex items-start justify-between gap-3 ${headTint}`}>
          <div className="min-w-0">
            {eyebrow && <div className="mb-1"><Eyebrow>{eyebrow}</Eyebrow></div>}
            {title && (
              <div className="flex items-center gap-2">
                {icon && <span className="text-[var(--accent)] flex shrink-0">{icon}</span>}
                <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
              </div>
            )}
            {sub && <p className="text-[12.5px] text-[var(--muted)] mt-1 leading-relaxed">{sub}</p>}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-3">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/* ── Stat tile ── */
export function StatTile({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string; icon?: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--line)] p-4">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-1">{icon}{label}</div>
      <div className={`text-2xl font-bold leading-tight tabular-nums ${accent ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>{value}</div>
      {sub && <p className="text-[12px] text-[var(--muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Alert card (tone-colored left border) ── */
export function AlertCard({ tone = 'neutral', title, body }: { tone?: Tone; title: string; body: React.ReactNode }) {
  const border: Record<Tone, string> = {
    neutral: 'border-l-[#94A3B8]', accent: 'border-l-[#4F46E5]', positive: 'border-l-[#16A34A]',
    warning: 'border-l-[#D97706]', critical: 'border-l-[#DC2626]', info: 'border-l-[#3B82F6]',
  };
  const ic: Record<Tone, string> = {
    neutral: 'text-[#64748B]', accent: 'text-[#4F46E5]', positive: 'text-[#16A34A]',
    warning: 'text-[#D97706]', critical: 'text-[#DC2626]', info: 'text-[#3B82F6]',
  };
  const Icon = { neutral: Info, accent: Zap, positive: CheckCircle, warning: AlertTriangle, critical: XCircle, info: Info }[tone];
  return (
    <div className={`bg-white rounded-xl border border-[var(--line)] border-l-4 ${border[tone]} p-4`}>
      <div className={`flex items-center gap-2 mb-0.5 ${ic[tone]}`}>
        <Icon size={13} /><span className="text-[13px] font-semibold text-[var(--ink)]">{title}</span>
      </div>
      <p className="text-[13px] text-[var(--muted)] pl-5 leading-relaxed">{body}</p>
    </div>
  );
}

/* ── Empty state ── */
export function EmptyState({ icon, title, body, action }: {
  icon: React.ReactNode; title: string; body: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-card shadow-card border border-[var(--line)] px-8 py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--accent-50)] flex items-center justify-center mx-auto mb-4" style={{ color: 'var(--accent)' }}>{icon}</div>
      <h2 className="text-[19px] font-semibold text-[var(--ink)]">{title}</h2>
      <p className="text-[14px] text-[var(--muted)] mt-2 max-w-md mx-auto leading-relaxed">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/* ── Buttons ── */
export function PrimaryButton({ children, onClick, href, className = '' }: {
  children: React.ReactNode; onClick?: () => void; href?: string; className?: string;
}) {
  const cls = `inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[14px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-600)] transition-colors ${className}`;
  if (href) return <a href={href} className={cls}>{children}</a>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function GhostButton({ children, onClick, className = '' }: {
  children: React.ReactNode; onClick?: () => void; className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--line-strong)] text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors ${className}`}>
      {children}
    </button>
  );
}

/* ── Journey stepper (the 6 Blueprint Journey stages) ── */
export const JOURNEY_STAGES = ['Evidence', 'Identity', 'Direction', 'Programs', 'Portfolio', 'Blueprint'] as const;
export function JourneyStepper({ current }: { current: number }) {
  return (
    <div className="flex items-start">
      {JOURNEY_STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold border-2 transition-colors ${
                done ? 'bg-[#16A34A] border-[#16A34A] text-white'
                : active ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                : 'bg-white border-[var(--line-strong)] text-[var(--muted)]'}`}>
                {done ? <CheckCircle size={13} /> : i + 1}
              </div>
              <span className={`text-[11px] font-semibold mt-1 text-center ${active ? 'text-[var(--accent)]' : done ? 'text-[#16A34A]' : 'text-[var(--muted)]'}`}>{s}</span>
            </div>
            {i < JOURNEY_STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 mt-3.5 mx-1 rounded-full ${done ? 'bg-[#16A34A]' : 'bg-[var(--line-strong)]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
