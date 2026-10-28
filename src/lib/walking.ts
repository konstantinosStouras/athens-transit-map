import type { FeatureCollection, LineString } from "geojson";
import { distM, type Pt } from "./trip";

export interface WalkingLeg { from: Pt; to: Pt; name: string; kind: "board" | "transfer" | "finish" | "nearby" }
export function closestPoint(points: Pt[], target: Pt): Pt {
  return points.reduce((best, point) => distM(point, target) < distM(best, target) ? point : best);
}
export function walkingDistance(leg: WalkingLeg): number { return distM(leg.from, leg.to); }
export function walkingLabel(leg: WalkingLeg, language: "el" | "en"): string {
  const metres = Math.round(walkingDistance(leg) / 10) * 10;
  const distance = metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} ${language === "en" ? "m" : "μ."}`;
  return language === "en" ? `Walk ≈ ${distance} · straight line` : `Πεζή ≈ ${distance} · σε ευθεία`;
}
export function walkingFC(legs: WalkingLeg[]): FeatureCollection<LineString> {
  return { type: "FeatureCollection", features: legs.filter(leg => walkingDistance(leg) >= 5).map(leg => ({ type: "Feature", properties: {},
    geometry: { type: "LineString", coordinates: [leg.from, leg.to].map(p => [p[1], p[0]]) } })) };
}
