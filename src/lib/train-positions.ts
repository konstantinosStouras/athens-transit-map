import type { Pt } from "./trip";

export interface TrainPosition {
  id: string; line: string; destination: string; next: string; point: Pt;
  estimated: boolean; indicative: boolean; at: number; delay: number | null;
}
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const coord = (v: Record<string, unknown>) => num(v.lat) && num(v.lon) && Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180;
export function trainPositions(value: unknown, mode: string, now: number): TrainPosition[] {
  if (!obj(value) || !num(value.updated_at) || value.updated_at < now - 120 || value.updated_at > now + 30)
    throw new Error("Stale train feed");
  const suburban = mode === "suburban", rows = suburban ? value.trains : value.vehicles;
  if (!Array.isArray(rows)) throw new Error("Invalid train feed");
  return rows.flatMap((v): TrainPosition[] => {
    if (!obj(v)) return [];
    if (suburban) {
      if (typeof v.train !== "string" || typeof v.to !== "string" || !coord(v) ||
          !num(v.position_at) || v.position_at < now - 120 || v.position_at > now + 30) return [];
      // The provider includes trains nationwide. This view is for Attica suburban services.
      if (v.service !== "Suburban" || (v.lat as number) < 37.5 || (v.lat as number) > 38.5 ||
          (v.lon as number) < 22.5 || (v.lon as number) > 24.5) return [];
      return [{ id: v.train, line: "Suburban", destination: v.to, next: typeof v.next_station === "string" ? v.next_station : "",
        point: [v.lat as number, v.lon as number], estimated: false, indicative: false, at: v.position_at,
        delay: num(v.delay_min) ? v.delay_min : null }];
    }
    if (v.line !== mode || typeof v.trip !== "string" || typeof v.headsign !== "string" ||
        !obj(v.from) || !obj(v.to) || !coord(v.from) || !coord(v.to) || !num(v.from.at) || !num(v.to.at)) return [];
    const a = v.from, b = v.to, start = a.at as number, end = b.at as number;
    // Never extrapolate past the supplied stop interval.
    if (now > end + 30 || now < start - 30) return [];
    const t = end > start ? Math.max(0, Math.min(1, (now - start) / (end - start))) : 0;
    return [{ id: v.trip, line: mode, destination: v.headsign, next: typeof b.name === "string" ? b.name : "",
      point: [(a.lat as number) + ((b.lat as number) - (a.lat as number)) * t,
        (a.lon as number) + ((b.lon as number) - (a.lon as number)) * t],
      estimated: true, indicative: value.indicative === true, at: value.updated_at as number, delay: null }];
  });
}
