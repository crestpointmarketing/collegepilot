'use client';

/**
 * Minimal markdown renderer for chat messages — headers, bold, italic, inline
 * code, bullet/numbered lists, and horizontal rules. Pure JSX (no
 * dangerouslySetInnerHTML), no dependency. Enough for advisor answers; not a
 * full CommonMark implementation.
 */
import React from 'react';

/** Inline: **bold**, *italic*, `code`. */
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Tokenize by code first so bold/italic never match inside backticks.
  const segments = text.split(/(`[^`]+`)/g);
  segments.forEach((seg, si) => {
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
      out.push(<code key={`c${si}`} className="px-1 py-0.5 rounded bg-black/[0.06] text-[12px] font-mono">{seg.slice(1, -1)}</code>);
      return;
    }
    const parts = seg.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
    parts.forEach((p, pi) => {
      const key = `t${si}-${pi}`;
      if (p.startsWith('**') && p.endsWith('**') && p.length > 4) out.push(<strong key={key}>{p.slice(2, -2)}</strong>);
      else if (p.startsWith('*') && p.endsWith('*') && p.length > 2) out.push(<em key={key}>{p.slice(1, -1)}</em>);
      else if (p) out.push(<React.Fragment key={key}>{p}</React.Fragment>);
    });
  });
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: React.ReactNode[] } | null = null;
  let k = 0;

  const flushList = () => {
    if (!list) return;
    const cls = 'my-1.5 flex flex-col gap-1 pl-1';
    blocks.push(
      list.ordered
        ? <ol key={k++} className={cls}>{list.items}</ol>
        : <ul key={k++} className={cls}>{list.items}</ul>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*(\d+)[.)]\s+(.*)$/);

    if (h) {
      flushList();
      const level = h[1].length;
      const sizes: Record<number, string> = { 1: 'text-[15px]', 2: 'text-[14px]', 3: 'text-[13.5px]', 4: 'text-[13px]' };
      blocks.push(<div key={k++} className={`${sizes[level]} font-bold mt-2.5 mb-1 first:mt-0`}>{renderInline(h[2])}</div>);
    } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushList();
      blocks.push(<hr key={k++} className="my-2.5 border-current opacity-15" />);
    } else if (bullet) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(<li key={`li${k}-${list.items.length}`} className="flex gap-2"><span className="shrink-0 opacity-60">•</span><span className="min-w-0">{renderInline(bullet[1])}</span></li>);
    } else if (num) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(<li key={`li${k}-${list.items.length}`} className="flex gap-2"><span className="shrink-0 opacity-60 tabular-nums">{num[1]}.</span><span className="min-w-0">{renderInline(num[2])}</span></li>);
    } else if (line.trim() === '') {
      flushList();
      blocks.push(<div key={k++} className="h-2" />);
    } else {
      flushList();
      blocks.push(<p key={k++} className="leading-relaxed">{renderInline(line)}</p>);
    }
  }
  flushList();

  return <div className="min-w-0">{blocks}</div>;
}
