import { distM, type Pt, type TripIndex } from "./trip";
import { fold } from "./search";
import type { LineLive, LineStatic } from "./types";

export interface StopService { line: string; variant: string; destination: string; destination_en?: string; boarding: boolean }
export interface StopPoint { id: number; name: string; name_en?: string; lat: number; lon: number; services: StopService[] }

// Keep physical stops separate: the same name across the road may serve the opposite direction.
export function indexStops(ix: TripIndex): StopPoint[] {
  const stops = ix.s.map(([name, lat, lon, name_en], id) => ({ id, name, name_en, lat, lon, services: [] as StopService[] }));
  for (const [line, variants] of Object.entries(ix.l)) for (const [variant, seq] of Object.entries(variants)) {
    const end = ix.s[seq.at(-1)!];
    if (!end) continue;
    for (const id of new Set(seq)) stops[id]?.services.push({ line, variant, destination: end[0], destination_en: end[3], boarding: seq.slice(0,-1).includes(id) });
  }
  for (const s of stops) s.services.sort((a, b) => a.line.localeCompare(b.line, "el", { numeric: true }) || a.variant.localeCompare(b.variant));
  return stops.filter(s => s.services.length && Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

export function findStops(stops: StopPoint[], query: string, origin: Pt | null, radius = 500, limit = 8) {
  const q = fold(query.trim());
  if (!origin && q.length < 2) return [];
  return stops.flatMap(stop => {
    if (q && ![stop.name, stop.name_en ?? ""].some(name => fold(name).includes(q))) return [];
    const distance = origin ? distM(origin, [stop.lat, stop.lon]) : null;
    return distance != null && distance > radius ? [] : [{ stop, distance }];
  }).sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0) || a.stop.name.localeCompare(b.stop.name, "el") || a.stop.id - b.stop.id).slice(0, limit);
}

// This is a stop count from the reported next stop, never a time prediction. Ambiguous loops,
// wrong directions, stale positions and mismatched static data must not produce a countdown.
export function approachingStop(stop: StopPoint, service: StopService, live: LineLive | undefined, statics: LineStatic | undefined, now: number) {
  if (!live || !statics || live.line !== service.line || statics.id !== service.line) return [];
  const route = statics.variants[service.variant];
  if (!route) return [];
  const targets = route.stops.flatMap((id, i) => {
    const s = statics.stops[id];
    return s && fold(s.name) === fold(stop.name) && distM([s.lat, s.lon], [stop.lat, stop.lon]) <= 12 ? [i] : [];
  });
  if (targets.length !== 1) return [];
  return live.vehicles.flatMap(v => {
    if (v.variant !== service.variant || !v.next_stop_id || !Number.isFinite(v.position_at) || v.position_at <= 0 || now - v.position_at > 120 || v.position_at > now + 30) return [];
    const next = route.stops.flatMap((id, i) => id === v.next_stop_id ? [i] : []);
    if (next.length !== 1 || next[0] > targets[0]) return [];
    return [{ id: v.id, stopsAway: targets[0] - next[0] + 1, positionAt: v.position_at }];
  }).sort((a, b) => a.stopsAway - b.stopsAway || b.positionAt - a.positionAt).slice(0, 3);
}
