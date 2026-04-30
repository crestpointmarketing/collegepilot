'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, User, Target, GraduationCap, FlaskConical, FileText, Download } from 'lucide-react';

const GLOBAL_NAV = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
];

const STUDENT_NAV = [
  { id: 'profile',   label: 'Profile',   icon: User },
  { id: 'strategy',  label: 'Strategy',  icon: Target },
  { id: 'schools',   label: 'Schools',   icon: GraduationCap },
  { id: 'research',  label: 'Research',  icon: FlaskConical },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'downloads', label: 'Downloads', icon: Download },
];

export function NavLinks({ variant = 'top' }: { variant?: 'top' | 'sidebar' }) {
  const pathname = usePathname();
  const studentMatch = /\/students\/([^/]+)/.exec(pathname);
  const currentStudentId = studentMatch?.[1];
  const activeTab = STUDENT_NAV.find(n => pathname.endsWith(`/${n.id}`) || pathname.includes(`/${n.id}/`))?.id;

  if (variant === 'sidebar') {
    return (
      <nav className="flex flex-col gap-0.5 px-3">
        {GLOBAL_NAV.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13.5px] font-medium transition-all ${
                active ? 'bg-[var(--accent-50)] text-[var(--accent)]' : 'text-[var(--ink-soft)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]'
              }`}
            >
              <Icon size={15} /> {item.label}
            </Link>
          );
        })}

        {currentStudentId && (
          <>
            <div className="mx-3 my-2 border-t border-[var(--line)]" />
            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">Student</div>
            {STUDENT_NAV.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/students/${currentStudentId}/${item.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded text-[13.5px] font-medium transition-all ${
                    active ? 'bg-[var(--accent-50)] text-[var(--accent)]' : 'text-[var(--ink-soft)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]'
                  }`}
                >
                  <Icon size={15} /> {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    );
  }

  return null; // top variant handled by TopNav directly
}
