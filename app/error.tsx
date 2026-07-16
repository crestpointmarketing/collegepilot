'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-soft)] px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-card border border-[var(--line)] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-[17px] font-semibold text-[var(--ink)] mb-2">Something went wrong</h2>
        <p className="text-[13.5px] text-[var(--muted)] mb-6">
          An unexpected error occurred while rendering this page.
          {error.digest && <span className="block mt-1 text-[12px]">Error ID: {error.digest}</span>}
        </p>
        <button
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13.5px] font-medium"
          style={{ background: 'var(--accent)' }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
