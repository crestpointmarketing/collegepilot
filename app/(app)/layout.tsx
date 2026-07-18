'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { TweaksPanel } from '@/components/tweaks/TweaksPanel';
import { ChatBot } from '@/components/chat/ChatBot';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useApp();
  const router = useRouter();

  // Auth guard: the workspace is meaningless without a session (all writes
  // would silently no-op), so send signed-out visitors back to the landing page.
  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-soft)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-[13px] text-[var(--ink-soft)]">Loading workspace…</p>
        </div>
      </div>
    );
  }

  // Sidebar is the app's navigation model (dashboard-style shell).
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto" data-scroll>
        <main className="px-8 pt-8 pb-36 max-w-[1280px] mx-auto">
          {children}
        </main>
      </div>
      <TweaksPanel />
      <ChatBot />
    </div>
  );
}
