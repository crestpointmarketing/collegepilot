'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from './BrandMark';
import { NavLinks } from './NavLinks';
import { Avatar } from '@/components/shared/Avatar';
import { useApp } from '@/context/AppContext';

export function Sidebar() {
  const { user, signOut } = useApp();
  const router = useRouter();
  const displayName = user?.email?.split('@')[0] ?? 'Counselor';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <aside className="w-[232px] h-full bg-white border-r border-[var(--line)] flex flex-col shrink-0 z-30">
      <Link href="/dashboard" className="p-5 border-b border-[var(--line)]">
        <BrandMark />
      </Link>
      <div className="flex-1 py-4 overflow-y-auto">
        <NavLinks variant="sidebar" />
      </div>
      <div className="p-4 border-t border-[var(--line)]">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2.5">
            <Avatar name={initials} color="#6366f1" size={30} />
            <div className="text-[13px] font-medium text-[var(--ink)]">{displayName}</div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-deep)] transition-colors"
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
