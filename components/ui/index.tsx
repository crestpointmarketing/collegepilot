'use client';

import type React from 'react';

/**
 * Shared UI primitives — the single source of truth for the platform's visual
 * language. Every page assembles from these instead of re-defining its own page
 * header / card / chip. Built on the CSS-variable tokens in globals.css.
 *
 * Type scale:  h1 28/semibold · card title 15/semibold · eyebrow 10.5/bold/upper
 * Rhythm:      cards gap-4 · card padding px-6 py-4 · header px-6 pt-4 pb-3.5
 */

/* ── Semantic tone — one color vocabulary for every chip/accent ── */
export type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'critical' | 'info';

export const CHIP_TONE: Record<Tone, string> = {
  neutral:  'bg-[var(--bg-soft)] text-[var(--muted)] border-[var(--line)]',
  accent:   'bg-[var(--accent-50)] text-[var(--accent)] border-[var(--accent-100)]',
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning:  'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-600 border-red-200',
  info:     'bg-blue-50 text-blue-700 border-blue-200',
};

export function Chip({ tone = 'neutral', icon, children, className = '' }: {
  tone?: Tone; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${CHIP_TONE[tone]} ${className}`}>
      {icon}{children}
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
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        {sub && <p className="text-[var(--muted)] mt-1">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ── Eyebrow label ── */
export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent)] ${className}`}>{children}</div>;
}

/* ── Card — the canonical section container ── */
export function Card({ eyebrow, title, sub, icon, actions, tone, children, className = '', bodyClassName = 'px-6 py-4' }: {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  /** Tints the header strip for status-bearing cards (e.g. alerts). */
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const hasHeader = eyebrow || title || actions;
  const headTint = tone === 'critical' ? 'bg-red-50/60 border-red-100'
    : tone === 'warning' ? 'bg-amber-50/60 border-amber-100'
    : 'border-[var(--line)]';
  return (
    <section className={`bg-white rounded-card shadow-card overflow-hidden ${className}`}>
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
export function StatTile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--bg-soft)] border border-[var(--line)] px-3 py-2.5">
      <div className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-0.5">{icon}{label}</div>
      <div className="text-[16px] font-bold text-[var(--ink)] tabular-nums">{value}</div>
    </div>
  );
}

/* ── Empty state ── */
export function EmptyState({ icon, title, body, action }: {
  icon: React.ReactNode; title: string; body: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-card shadow-card px-8 py-14 text-center">
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
  const cls = `inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-[14px] font-semibold transition-opacity hover:opacity-90 ${className}`;
  if (href) return <a href={href} className={cls} style={{ background: 'var(--accent)' }}>{children}</a>;
  return <button type="button" onClick={onClick} className={cls} style={{ background: 'var(--accent)' }}>{children}</button>;
}

export function GhostButton({ children, onClick, className = '' }: {
  children: React.ReactNode; onClick?: () => void; className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--line-strong)] text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--bg-soft)] transition-colors ${className}`}>
      {children}
    </button>
  );
}
