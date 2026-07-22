'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Downloads has been merged into Documents ("Documents & Downloads"). This
 * route is kept as a redirect so old links and bookmarks still resolve.
 */
export default function DownloadsRedirect() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  useEffect(() => {
    router.replace(`/students/${studentId}/documents`);
  }, [studentId, router]);

  return <div className="text-[var(--muted)]">Redirecting to Documents…</div>;
}
