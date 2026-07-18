/**
 * Deterministic JSON serialization with sorted object keys.
 *
 * Postgres jsonb does NOT preserve key order, so comparing a DB-loaded object
 * to an in-code literal via JSON.stringify equality silently fails almost
 * always. Use this for content-identity checks instead.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .filter(k => (value as Record<string, unknown>)[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',');
  return `{${body}}`;
}

export function stableEquals(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
