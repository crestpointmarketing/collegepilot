// Per-user fixed-window rate limiter for the AI routes.
// In-memory: each server instance (and each edge isolate) keeps its own window,
// so this is a best-effort cost guard, not a hard global quota.

const buckets = new Map<string, { count: number; resetAt: number }>();

const MAX_BUCKETS = 5000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, bucket] of buckets) {
      if (now >= bucket.resetAt) buckets.delete(k);
    }
  }

  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (oldestKey) buckets.delete(oldestKey);
  }

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (existing.count < limit) {
    existing.count += 1;
    return { ok: true, retryAfterSeconds: 0 };
  }
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
}

export function rateLimitMessage(action: string, result: RateLimitResult): string {
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  return `${action} limit reached. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
