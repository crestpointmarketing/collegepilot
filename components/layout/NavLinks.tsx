'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LayoutGrid, User, ClipboardCheck, Target, CalendarDays, GraduationCap, FlaskConical, FileText, Download, ScrollText } from 'lucide-react';

const GLOBAL_NAV = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
];

const STUDENT_NAV = [
  { id: 'overview',   label: 'Overview',   icon: LayoutGrid },
  { id: 'profile',    label: 'Profile',    icon: User },
  { id: 'assessment', label: 'Assessment', icon: ClipboardCheck },
  { id: 'strategy',   label: 'Strategy',   icon: Target },
  { id: 'blueprint',  label: 'Blueprint',  icon: ScrollText },
  { id: 'timeline',   label: 'Timeline',   icon: CalendarDays },
  { id: 'schools',    label: 'Schools',    icon: GraduationCap },
  { id: 'research',   label: 'Research',   icon: FlaskConical },
  { id: 'documents',  label: 'Documents',  icon: FileText },
  { id: 'downloads',  label: 'Downloads',  icon: Download },
];

/** Sidebar navigation links — the sidebar is the app's only navigation shell. */
export function NavLinks() {
  const pathname = usePathname();
  const studentMatch = /\/students\/([^/]+)/.exec(pathname);
  const currentStudentId = studentMatch?.[1];
  const activeTab = STUDENT_NAV.find(n => pathname.endsWith(`/${n.id}`) || pathname.includes(`/${n.id}/`))?.id;

  const itemCls = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-all ${
      active ? 'bg-white/15 text-white shadow-sm' : 'text-white/65 hover:bg-white/8 hover:text-white'
    }`;
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {GLOBAL_NAV.map(item => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link key={item.id} href={item.href} className={itemCls(active)}>
            <Icon size={15} /> {item.label}
          </Link>
        );
      })}

      {currentStudentId && (
        <>
          <div className="mx-3 my-2 border-t border-white/10" />
          <div className="px-3 py-1 text-[10.5px] font-semibold uppercase tracking-widest text-white/40">Student</div>
          {STUDENT_NAV.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <Link key={item.id} href={`/students/${currentStudentId}/${item.id}`} className={itemCls(active)}>
                <Icon size={15} /> {item.label}
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );
}
