/**
 * Client helper for the essay API routes, which stream a heartbeat (spaces)
 * followed by one JSON object — the same gateway-timeout workaround as the
 * strategy/blueprint routes.
 */
export async function fetchStreamedJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { error?: string }).error || `Server error ${res.status}`);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
  }
  const m = full.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Invalid response from server${full.trim() ? `: ${full.trim().slice(0, 200)}` : ''}`);
  const raw = JSON.parse(m[0]) as { error?: string };
  if (raw.error) throw new Error(raw.error);
  return raw;
}
