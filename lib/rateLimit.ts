// Per-user rate limiter for the AI routes.
//
// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, limiting is
// backed by Upstash Redis (a single shared sliding window across every
// serverless instance/edge isolate — a real global cap). Without those env
// vars, or if Redis is unreachable, it falls back to a best-effort in-memory
// window per instance. checkRateLimit is async either way.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/* ── Upstash (shared, authoritative) ── */

const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = hasUpstash ? Redis.fromEnv() : null;
const limiters = new Map<string, Ratelimit>();

function limiterFor(limit: number, windowSeconds: number): Ratelimit {
  const cacheKey = `${limit}:${windowSeconds}`;
  let l = limiters.get(cacheKey);
  if (!l) {
    l = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: 'cp-rl',
      analytics: false,
    });
    limiters.set(cacheKey, l);
  }
  return l;
}

/* ── In-memory fallback (best-effort, per instance) ── */

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 5000;

function checkInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, bucket] of buckets) if (now >= bucket.resetAt) buckets.delete(k);
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

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const windowSeconds = Math.ceil(windowMs / 1000);
  if (hasUpstash) {
    try {
      const res = await limiterFor(limit, windowSeconds).limit(key);
      return {
        ok: res.success,
        retryAfterSeconds: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
      };
    } catch (err) {
      // Redis unreachable — degrade to the in-memory guard rather than blocking
      // (or unbounded-allowing) the user on a transient network error.
      console.error('rateLimit: Upstash unavailable, using in-memory fallback:', err);
    }
  }
  return checkInMemory(key, limit, windowMs);
}

export function rateLimitMessage(action: string, result: RateLimitResult): string {
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  return `${action} limit reached. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
