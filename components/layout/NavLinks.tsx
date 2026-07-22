'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LayoutGrid, FileText, Compass, Search, Layers, ScrollText, CalendarDays, FolderOpen, PenLine } from 'lucide-react';

const GLOBAL_NAV = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
];

/**
 * The nav mirrors the Figma "Blueprint Journey" structure: one ordered Journey
 * group + a small Utility group. Pages that are steps *within* the flow rather
 * than destinations — Assessment, Strategy, Research, the Schools list — are
 * reached contextually (from Overview, Evidence, Portfolio, and school detail),
 * not from the sidebar, so the rail stays short and legible.
 */
const JOURNEY_NAV = [
  { id: 'overview',  label: 'Overview',          icon: LayoutGrid },
  { id: 'profile',   label: 'Evidence',          icon: FileText },
  { id: 'direction', label: 'Direction',         icon: Compass },
  { id: 'programs',  label: 'Programs & Schools', icon: Search },
  { id: 'portfolio', label: 'Portfolio',         icon: Layers },
  { id: 'blueprint', label: 'Blueprint',         icon: ScrollText },
];

const UTILITY_NAV = [
  { id: 'timeline',  label: 'Timeline',  icon: CalendarDays },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'essays',    label: 'Essays',    icon: PenLine },
];

const ALL_STUDENT_NAV = [...JOURNEY_NAV, ...UTILITY_NAV];

/** Sidebar navigation links — the sidebar is the app's only navigation shell. */
export function NavLinks() {
  const pathname = usePathname();
  const studentMatch = /\/students\/([^/]+)/.exec(pathname);
  const currentStudentId = studentMatch?.[1];
  // School detail (/schools/[id]) lives under "Programs & Schools" — keep that item lit.
  const onSchoolDetail = /\/schools\/[^/]+$/.test(pathname);
  const activeTab = onSchoolDetail
    ? 'programs'
    : ALL_STUDENT_NAV.find(n => pathname.endsWith(`/${n.id}`) || pathname.includes(`/${n.id}/`))?.id;

  const itemCls = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-colors ${
      active ? 'bg-[rgba(79,70,229,0.2)] text-white' : 'text-[#c7cafe] hover:bg-white/[0.06] hover:text-white'
    }`;

  const renderItem = (item: { id: string; label: string; icon: typeof LayoutGrid }) => {
    const Icon = item.icon;
    return (
      <Link key={item.id} href={`/students/${currentStudentId}/${item.id}`} className={itemCls(activeTab === item.id)}>
        <Icon size={15} /> {item.label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {GLOBAL_NAV.map(item => {
        const Icon = item.icon;
        return (
          <Link key={item.id} href={item.href} className={itemCls(pathname === item.href)}>
            <Icon size={15} /> {item.label}
          </Link>
        );
      })}

      {currentStudentId && (
        <>
          <div className="mx-3 my-1.5 border-t border-white/10" />
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#8b94b2]">Blueprint Journey</div>
          {JOURNEY_NAV.map(renderItem)}

          <div className="mx-3 my-1.5 border-t border-white/10" />
          {UTILITY_NAV.map(renderItem)}
        </>
      )}
    </nav>
  );
}
