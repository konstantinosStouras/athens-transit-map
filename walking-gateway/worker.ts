// Deploy only on Workers Free. Never expose GOOGLE_ROUTES_KEY to the browser.
interface Statement { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null> }
export interface Env {
  DB: { prepare(sql: string): Statement };
  GOOGLE_ROUTES_KEY?: string;
  WALKING_ENABLED?: string;
  // Explicit, reviewed allocation from the billing account's SHARED allowance.
  ALLOWANCE_MONTH?: string;
  MONTHLY_LIMIT?: string;
}
type Point = [number, number];
const ORIGINS = new Set(['https://www.stouras.com', 'https://stouras.com']);
export const RESERVE_SQL = `INSERT INTO walking_usage(month, used, day, day_used)
VALUES (?, 1, ?, 1)
ON CONFLICT(month) DO UPDATE SET used = used + 1, day = excluded.day,
day_used = CASE WHEN day = excluded.day THEN day_used + 1 ELSE 1 END
WHERE used < ? AND (day <> excluded.day OR day_used < 300)
RETURNING used`;

export function billingPeriod(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  const month = `${get('year')}-${get('month')}`;
  return { month, day: `${month}-${get('day')}` };
}
function point(p: unknown): p is Point {
  return Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v)) &&
    p[0] >= 37.5 && p[0] <= 38.5 && p[1] >= 22.8 && p[1] <= 24.4;
}
function validLeg(v: unknown): v is { from: Point; to: Point } {
  if (!v || typeof v !== 'object') return false;
  const x = v as { from?: unknown; to?: unknown };
  return point(x.from) && point(x.to) && Math.hypot((x.from[0] - x.to[0]) * 111320, (x.from[1] - x.to[1]) * 87700) <= 5000;
}
const location = ([latitude, longitude]: Point) => ({ location: { latLng: { latitude, longitude } } });

export async function handle(request: Request, env: Env, fetcher: typeof fetch = fetch, now = new Date()): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    ...(ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) };
  const reply = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers });
  if (!ORIGINS.has(origin)) return reply(403, 'origin');
  if (new URL(request.url).pathname !== '/walk') return reply(404, 'not_found');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
  if (request.method !== 'POST') return reply(405, 'method');
  const period = billingPeriod(now), limit = Number(env.MONTHLY_LIMIT);
  if (env.WALKING_ENABLED !== 'true' || !env.GOOGLE_ROUTES_KEY || env.ALLOWANCE_MONTH !== period.month || !Number.isInteger(limit) || limit < 1 || limit > 9000)
    return reply(503, 'disabled');
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply(415, 'content_type');
  if (Number(request.headers.get('Content-Length')) > 1024) return reply(413, 'too_large');
  // Bounded stream, including requests without Content-Length.
  let raw = '';
  const reader = request.body?.getReader();
  if (!reader) return reply(400, 'invalid');
  let bytes = 0;
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 1024) { await reader.cancel(); return reply(413, 'too_large'); }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  let leg: unknown;
  try { leg = JSON.parse(raw); } catch { return reply(400, 'invalid'); }
  if (!validLeg(leg)) return reply(400, 'invalid');
  // Atomic durable reservation BEFORE every upstream call. Never refund or retry.
  // An exhausted/unavailable database prevents ALL Google calls.
  try {
    const slot = await env.DB.prepare(RESERVE_SQL).bind(period.month, period.day, limit).first<{ used: number }>();
    if (!slot) return reply(429, 'limit');
  } catch { return reply(503, 'counter_unavailable'); }
  try {
    const response = await fetcher('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_ROUTES_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring' },
      body: JSON.stringify({ origin: location(leg.from), destination: location(leg.to), travelMode: 'WALK',
        computeAlternativeRoutes: false, polylineEncoding: 'GEO_JSON_LINESTRING', units: 'METRIC' }),
      signal: AbortSignal.timeout(12000), redirect: 'error',
    });
    if (!response.ok) return reply(503, 'upstream_unavailable');
    const payload = await response.json() as { routes?: { distanceMeters?: number; duration?: string; polyline?: { geoJsonLinestring?: unknown } }[] };
    const route = payload.routes?.[0];
    if (!route) return reply(404, 'no_route');
    const duration = typeof route.duration === 'string' && /^\d+(\.\d+)?s$/.test(route.duration) ? Number(route.duration.slice(0, -1)) : NaN;
    if (!Number.isFinite(duration) || !Number.isFinite(route.distanceMeters)) return reply(503, 'invalid_route');
    return new Response(JSON.stringify({ metres: route.distanceMeters, seconds: duration, geometry: route.polyline?.geoJsonLinestring, provider: 'google' }), { headers });
  } catch { return reply(503, 'upstream_unavailable'); }
}
export default { fetch: (request: Request, env: Env) => handle(request, env) };
