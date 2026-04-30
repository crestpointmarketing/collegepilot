'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, User, Target, FileText, Download, GraduationCap, FlaskConical, Check } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { SaveIndicator } from '@/components/shared/SaveIndicator';
import { Avatar } from '@/components/shared/Avatar';
import { useApp } from '@/context/AppContext';

const STUDENT_NAV = [
  { id: 'profile',   label: 'Profile',   icon: User },
  { id: 'strategy',  label: 'Strategy',  icon: Target },
  { id: 'schools',   label: 'Schools',   icon: GraduationCap },
  { id: 'research',  label: 'Research',  icon: FlaskConical },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'downloads', label: 'Downloads', icon: Download },
];

export function TopNav() {
  const { saveState, user, signOut, students } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  const displayName = user?.email?.split('@')[0] ?? 'Counselor';
  const initials = displayName.slice(0, 2).toUpperCase();

  // Detect student context from URL
  const studentMatch = /\/students\/([^/]+)/.exec(pathname);
  const currentStudentId = studentMatch?.[1];
  const currentStudent = currentStudentId ? students.find(s => s.id === currentStudentId) : null;
  const activeTab = STUDENT_NAV.find(n => pathname.endsWith(`/${n.id}`) || pathname.includes(`/${n.id}/`))?.id;

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const switchStudent = (studentId: string) => {
    setPickerOpen(false);
    const tab = activeTab ?? 'strategy';
    router.push(`/students/${studentId}/${tab}`);
  };

  return (
    <header className="h-[52px] bg-white border-b border-[var(--line)] flex items-center px-5 gap-3 z-30 shrink-0">
      {/* Logo */}
      <Link href="/dashboard" className="shrink-0">
        <BrandMark />
      </Link>

      {currentStudent ? (
        <>
          <div className="w-px h-5 bg-[var(--line)] shrink-0" />

          {/* Student picker */}
          <div className="relative shrink-0">
            <button
              onClick={() => setPickerOpen(p => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-soft)] transition-colors max-w-[180px]"
            >
              <div
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: currentStudent.color ?? '#6366f1' }}
              >
                {currentStudent.name.slice(0, 1)}
              </div>
              <span className="text-[13.5px] font-semibold text-[var(--ink)] truncate">
                {currentStudent.name}
              </span>
              <ChevronDown size={13} className="text-[var(--muted)] shrink-0" />
            </button>

            {pickerOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
                <div className="absolute left-0 top-full mt-1 w-[240px] bg-white border border-[var(--line)] rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
                  <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                    Switch student
                  </div>
                  {students.map(s => (
                    <button
                      key={s.id}
                      onClick={() => switchStudent(s.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--bg-soft)] transition-colors text-left"
                    >
                      <div
                        className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-[11px] font-bold"
                        style={{ background: s.color ?? '#6366f1' }}
                      >
                        {s.name.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[var(--ink)] truncate">{s.name}</div>
                        <div className="text-[11px] text-[var(--muted)] truncate">{s.major} · Grade {s.grade}</div>
                      </div>
                      {s.id === currentStudentId && (
                        <Check size={13} className="text-[var(--accent)] shrink-0" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-[var(--line)] mt-1 pt-1">
                    <button
                      onClick={() => { setPickerOpen(false); router.push('/dashboard'); }}
                      className="w-full flex items-center px-3 py-2 text-[13px] text-[var(--accent)] hover:bg-[var(--bg-soft)] transition-colors font-medium"
                    >
                      ← All students
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Student nav */}
          <nav className="flex items-center gap-0.5 flex-1">
            {STUDENT_NAV.map(item => {
              const active = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/students/${currentStudentId}/${item.id}`}
                  className={`px-3 py-1.5 rounded text-[13px] font-medium transition-all ${
                    active
                      ? 'bg-[var(--bg-soft)] text-[var(--ink)]'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </>
      ) : (
        /* Global nav — Dashboard only */
        <nav className="flex items-center gap-0.5 flex-1">
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded text-[13.5px] font-medium transition-all ${
              pathname === '/dashboard'
                ? 'bg-[var(--bg-soft)] text-[var(--ink)]'
                : 'text-[var(--ink-soft)] hover:bg-[var(--bg-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Dashboard
          </Link>
        </nav>
      )}

      {/* Right: save indicator + user */}
      <div className="flex items-center gap-2 shrink-0">
        {pathname.includes('/profile') && <SaveIndicator state={saveState} />}
        <div className="flex items-center gap-2 bg-[var(--bg-soft)] rounded-pill px-2.5 py-1.5">
          <Avatar name={initials} color="#6366f1" size={22} />
          <span className="text-[13px] font-medium text-[var(--ink)]">{displayName}</span>
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-deep)] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
