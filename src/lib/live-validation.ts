import type { Vehicle } from "./types";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nullableText = (v: unknown) => v === null || typeof v === "string";
const optionalText = (v: unknown) => v === undefined || nullableText(v);
const optionalNumber = (v: unknown) => v == null || finite(v);
const latitude = (v: unknown) => finite(v) && Math.abs(v) <= 90;
const longitude = (v: unknown) => finite(v) && Math.abs(v) <= 180;
const path = (v: unknown) => v == null || (Array.isArray(v) && v.length >= 2 &&
  v.every(p => Array.isArray(p) && p.length === 2 && latitude(p[0]) && longitude(p[1])));

// Validate before callbacks: malformed motion geometry can throw inside the map,
// while null rows can throw in selection handling and stop the polling loop.
// Missing optional fields remain compatible with older backend versions.
export function validLiveVehicle(value: unknown): value is Vehicle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && !!v.id.trim() && latitude(v.lat) && longitude(v.lon) &&
    finite(v.position_at) && v.position_at > 0 &&
    (v.bearing === null || (finite(v.bearing) && v.bearing >= 0 && v.bearing <= 360)) &&
    typeof v.route_code === "string" && nullableText(v.variant) && nullableText(v.trip_id) &&
    nullableText(v.trip_label) && optionalText(v.trip_label_en) && nullableText(v.next_stop_id) &&
    (v.delay_s === null || finite(v.delay_s)) &&
    optionalNumber(v.speed) && (v.speed == null || (v.speed as number) >= 0) &&
    path(v.path) && path(v.path_beyond) &&
    (v.path_stops == null || (Array.isArray(v.path_stops) && v.path_stops.every((s, i, all) =>
      finite(s) && s >= 0 && (i === 0 || s >= all[i - 1])))) &&
    (v.path_speeds == null || (Array.isArray(v.path_speeds) && v.path_speeds.every(s =>
      s === null || (finite(s) && s >= 0))));
}
