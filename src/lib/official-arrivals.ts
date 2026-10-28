import { fold } from "./search";
import { distM } from "./trip";
import type { StopPoint } from "./stops";
import type { LineStatic } from "./types";

// Resolve against the existing static route data, never guess from a name alone.
// OASA StopCode is the static stop key, not our compact trip-index position
// or the public StopID printed on the sign (e.g. 60806 versus 060806).
export function officialStopCode(stop: StopPoint, line: LineStatic): string | null {
  const variants = stop.services.filter(s => s.line === line.id).map(s => s.variant);
  if (!variants.length || variants.some(v => !line.variants[v])) return null;
  const candidates = new Set<string>();
  for (const variant of variants) {
    const matches = line.variants[variant].stops.filter(code => {
      const s = line.stops[code];
      return s && /^\d{1,10}$/.test(code) && fold(s.name) === fold(stop.name) &&
        distM([s.lat, s.lon], [stop.lat, stop.lon]) <= 12;
    });
    if (!matches.length) return null;
    matches.forEach(code => candidates.add(code));
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

export function officialArrivalsUrl(stop: StopPoint, code: string | null, language: string): string {
  const base = `https://telematics.oasa.gr/${language === "en" ? "en/" : ""}`;
  if (!code || !/^\d{1,10}$/.test(code) || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lon) ||
      stop.lat < 37 || stop.lat > 39 || stop.lon < 22 || stop.lon > 25) return base;
  // Underscores delimit the official hash. Keep the display label plain text.
  const label = (language === "en" ? stop.name_en || stop.name : stop.name)
    .replace(/[^\p{L}\p{N}\s.()\-]/gu, " ").trim() || "Stop";
  return `${base}#stationInfo_${code}_${encodeURIComponent(label)}_${stop.lat},${stop.lon}`;
}
