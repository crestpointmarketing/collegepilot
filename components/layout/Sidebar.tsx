'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { RadarIcon } from './BrandMark';
import { NavLinks } from './NavLinks';
import { Avatar } from '@/components/shared/Avatar';
import { useApp } from '@/context/AppContext';
import { getUserDisplay } from '@/lib/userDisplay';
import { computeReadiness } from '@/components/assessment/ui';

function ReadinessRing({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width={68} height={68} viewBox="0 0 68 68">
      <circle cx={34} cy={34} r={r} stroke="rgba(255,255,255,0.14)" strokeWidth={6} fill="none" />
      <circle
        cx={34} cy={34} r={r}
        stroke="#4f46e5" strokeWidth={6} fill="none" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform="rotate(-90 34 34)"
      />
      <text x={34} y={32} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fff">{pct}%</text>
      <text x={34} y={45} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.55)">Overall</text>
    </svg>
  );
}

export function Sidebar() {
  const { user, signOut, strategies } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const userDisplay = user ? getUserDisplay(user) : null;

  const studentId = /\/students\/([^/]+)/.exec(pathname)?.[1];
  const dimensions = studentId ? strategies[studentId]?.v2?.assessment?.dimensions : undefined;
  const readiness = dimensions ? computeReadiness(dimensions) : null;

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <aside className="w-[240px] h-full flex flex-col shrink-0 z-30 bg-[#1b2033] text-white">
      <Link href="/dashboard" className="px-5 py-5 flex items-center gap-2.5 border-b border-white/10">
        <RadarIcon size={22} />
        <span className="font-semibold text-[14.5px] tracking-tight text-white">CollegePilot</span>
      </Link>

      <div className="flex-1 py-4 overflow-y-auto">
        <NavLinks />
      </div>

      {/* Evidence readiness — only when the active student has a v2 strategy */}
      {readiness && (
        <div
          className="mx-4 mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3"
          title="How well-anchored the profile assessment is, from per-dimension confidence. A display heuristic — not an admission metric."
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1.5">Evidence Readiness</div>
          <div className="flex items-center gap-3">
            <ReadinessRing pct={readiness.pct} />
            <div className="flex flex-col gap-1 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> High <span className="ml-auto text-white/60">{readiness.high}</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Medium <span className="ml-auto text-white/60">{readiness.medium}</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white/40" /> Low <span className="ml-auto text-white/60">{readiness.low}</span></span>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex min-w-0 items-center gap-2.5" title={userDisplay?.label}>
            <Avatar name={userDisplay?.initials ?? '?'} color="#4f46e5" size={30} />
            <div className="truncate text-[13px] font-medium text-white/90">
              {userDisplay?.label ?? 'Loading account...'}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
