import type { TripIndex } from "./trip";

/** Reject a malformed or partially written index before it is used for routing. */
export function validateTripIndex(value: unknown): TripIndex {
  if (!value || typeof value !== "object") throw new Error("Invalid trip index");
  const data = value as Record<string, unknown>;
  if (typeof data.v !== "string" || !data.v.trim() || !Array.isArray(data.s) || !data.s.length ||
      !data.l || typeof data.l !== "object" || Array.isArray(data.l)) throw new Error("Invalid trip index header");
  for (const stop of data.s) {
    if (!Array.isArray(stop) || typeof stop[0] !== "string" || !stop[0].trim() ||
        typeof stop[1] !== "number" || !Number.isFinite(stop[1]) || Math.abs(stop[1]) > 90 ||
        typeof stop[2] !== "number" || !Number.isFinite(stop[2]) || Math.abs(stop[2]) > 180 ||
        (stop[3] != null && typeof stop[3] !== "string")) throw new Error("Invalid stop in trip index");
  }
  const lines = data.l as Record<string, unknown>;
  const stopCount = data.s.length;
  if (!Object.keys(lines).length) throw new Error("Trip index has no lines");
  for (const variants of Object.values(lines)) {
    if (!variants || typeof variants !== "object" || Array.isArray(variants)) throw new Error("Invalid route variants");
    for (const sequence of Object.values(variants)) {
      if (!Array.isArray(sequence) || !sequence.length || sequence.some(id => !Number.isInteger(id) || id < 0 || id >= stopCount))
        throw new Error("Invalid stop reference in trip index");
    }
  }
  return value as TripIndex;
}
