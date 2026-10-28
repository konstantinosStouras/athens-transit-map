/** Optional live rail API. Timestamps are Unix seconds; coordinates are WGS84. */
export interface RailVehicle { id: string; line: string; lat: number; lon: number; position_at: number }
export interface RailFeed { generated_at: number; vehicles: RailVehicle[] }

export function parseRailFeed(value: unknown, allowedLines: Set<string>, now: number): RailFeed | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.source !== "realtime" || typeof data.generated_at !== "number" || !Number.isFinite(data.generated_at) ||
      data.generated_at < now - 120 || data.generated_at > now + 30 || !Array.isArray(data.vehicles)) return null;
  const seen = new Set<string>();
  const vehicles: RailVehicle[] = [];
  for (const row of data.vehicles) {
    if (!row || typeof row !== "object") continue;
    const v = row as Record<string, unknown>;
    if (typeof v.id !== "string" || !v.id.trim() || v.id.length > 100 || typeof v.line !== "string" || !allowedLines.has(v.line) ||
        typeof v.lat !== "number" || !Number.isFinite(v.lat) || v.lat < 37 || v.lat > 39 ||
        typeof v.lon !== "number" || !Number.isFinite(v.lon) || v.lon < 22 || v.lon > 25 ||
        typeof v.position_at !== "number" || !Number.isFinite(v.position_at) || v.position_at < now - 120 || v.position_at > now + 30) continue;
    const key = `${v.line}\0${v.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    vehicles.push({ id: v.id, line: v.line, lat: v.lat, lon: v.lon, position_at: v.position_at });
  }
  return { generated_at: data.generated_at, vehicles };
}

export function railVehicleFC(feed: RailFeed | null, shown: string[], now: number): GeoJSON.FeatureCollection {
  if (!feed || feed.generated_at < now - 120 || feed.generated_at > now + 30) return { type: "FeatureCollection", features: [] };
  return { type: "FeatureCollection", features: feed.vehicles.filter(v => shown.includes(v.line) && v.position_at >= now - 120 && v.position_at <= now + 30)
    .map(v => ({ type: "Feature", geometry: { type: "Point", coordinates: [v.lon, v.lat] },
      properties: { id: v.id, line: v.line, position_at: v.position_at } })) };
}
