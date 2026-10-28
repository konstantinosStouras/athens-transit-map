import type { LineString } from 'geojson';
import type { WalkingLeg } from './walking';
export interface WalkRoute { metres: number; seconds: number; geometry: LineString; provider: 'google' }
export function parseWalkRoute(value: unknown): WalkRoute | null {
  const r = value as Partial<WalkRoute> | null;
  if (!r || r.provider !== 'google' || typeof r.metres !== 'number' || !Number.isFinite(r.metres) || r.metres < 0 || r.metres > 50000 ||
    typeof r.seconds !== 'number' || !Number.isFinite(r.seconds) || r.seconds < 0 || r.seconds > 86400 ||
    r.geometry?.type !== 'LineString' || !Array.isArray(r.geometry.coordinates) || r.geometry.coordinates.length < 2 || r.geometry.coordinates.length > 20000 ||
    !r.geometry.coordinates.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 22.5 && p[0] <= 25 && p[1] >= 37 && p[1] <= 39)) return null;
  return r as WalkRoute;
}
export class WalkingRouteError extends Error {}
// No persistent route cache or background refresh. Each explicit calculation is bounded.
export async function routeWalking(legs: WalkingLeg[], endpoint: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<WalkingLeg[]> {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new WalkingRouteError('disabled');
  if (legs.length > 3) throw new WalkingRouteError('invalid');
  const result: WalkingLeg[] = [];
  for (const leg of legs) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (leg.route) { result.push(leg); continue; }
    // Identical endpoints require no Google call; don't invent a route for close points.
    if (leg.from[0] === leg.to[0] && leg.from[1] === leg.to[1]) { result.push(leg); continue; }
    const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: leg.from, to: leg.to }), signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new WalkingRouteError(response.status === 429 ? 'limit' : response.status === 404 ? 'no_route' : 'unavailable');
    const route = parseWalkRoute(await response.json());
    if (!route) throw new WalkingRouteError('unavailable');
    result.push({ ...leg, route });
  }
  return result;
}
