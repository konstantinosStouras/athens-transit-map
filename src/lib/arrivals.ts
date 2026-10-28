/** Contract for an optional, independently supplied real-time arrival feed. */
export interface ArrivalPrediction {
  line: string;
  variant: string;
  arrival: number; // Unix seconds
}

export interface ArrivalFeed {
  gtfs_version: string;
  stop_index: number;
  generated_at: number;
  predictions: ArrivalPrediction[];
}

// Never turn a schedule or stale/mismatched data into a real-time countdown.
export function parseArrivals(value: unknown, version: string, stop: number, now: number): ArrivalFeed | null {
  if (!value || typeof value !== "object") return null;
  const feed = value as Record<string, unknown>;
  if (feed.source !== "realtime" || feed.gtfs_version !== version || feed.stop_index !== stop ||
      typeof feed.generated_at !== "number" || !Number.isFinite(feed.generated_at) ||
      feed.generated_at > now + 30 || feed.generated_at < now - 120 || !Array.isArray(feed.predictions)) return null;
  const predictions = feed.predictions.flatMap((entry): ArrivalPrediction[] => {
    if (!entry || typeof entry !== "object") return [];
    const p = entry as Record<string, unknown>;
    if (typeof p.line !== "string" || !p.line || typeof p.variant !== "string" || !p.variant ||
        typeof p.arrival !== "number" || !Number.isFinite(p.arrival) || p.arrival < now || p.arrival > now + 7200) return [];
    return [{ line: p.line, variant: p.variant, arrival: p.arrival }];
  }).sort((a, b) => a.arrival - b.arrival);
  return { gtfs_version: version, stop_index: stop, generated_at: feed.generated_at, predictions };
}

export function arrivalsFor(feed: ArrivalFeed | null, line: string, variants: string[], now: number): ArrivalPrediction[] {
  if (!feed || feed.generated_at < now - 120 || feed.generated_at > now + 30) return [];
  return feed.predictions.filter(p => p.line === line && variants.includes(p.variant) && p.arrival >= now).slice(0, 3);
}
