import type { LineStatic, Status } from "./types";
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown) => typeof v === "string";
const translation = (v: unknown) => v == null || text(v);
const coordinate = (lat: unknown, lon: unknown) => finite(lat) && Math.abs(lat) <= 90 && finite(lon) && Math.abs(lon) <= 180;

export function validLineStatic(value: unknown, line: string): value is LineStatic {
  if (!object(value) || value.id !== line || !object(value.variants) || !object(value.stops)) return false;
  const stops = value.stops;
  return Object.values(stops).every(s => object(s) && text(s.name) && translation(s.name_en) && coordinate(s.lat, s.lon)) &&
    Object.values(value.variants).every(v => object(v) && text(v.headsign) && translation(v.headsign_en) && finite(v.direction) &&
      Array.isArray(v.shape) && v.shape.every(p => Array.isArray(p) && p.length === 2 && coordinate(p[0], p[1])) &&
      Array.isArray(v.stops) && v.stops.every(id => text(id) && Object.hasOwn(stops, id as string)));
}

export function validStatus(value: unknown): value is Status {
  return object(value) && typeof value.ok === "boolean" && text(value.gtfs_version) &&
    typeof value.gtfs_expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.gtfs_expires) &&
    finite(value.updated_at) && value.updated_at > 0 && finite(value.lines_active) && value.lines_active >= 0 &&
    finite(value.budget_rps) && value.budget_rps >= 0;
}
