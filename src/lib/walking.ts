import type { FeatureCollection, LineString } from "geojson";
import { distM, type Pt } from "./trip";
import type { WalkRoute } from './walking-router';

export interface WalkingLeg { from: Pt; to: Pt; name: string; kind: "board" | "transfer" | "finish" | "nearby"; route?: WalkRoute }
export function closestPoint(points: Pt[], target: Pt): Pt {
  return points.reduce((best, point) => distM(point, target) < distM(best, target) ? point : best);
}
export function walkingDistance(leg: WalkingLeg): number { return distM(leg.from, leg.to); }
export function walkingLabel(leg: WalkingLeg, language: "el" | "en"): string {
  if (!leg.route) return language === 'en' ? 'Walking route not calculated' : 'Δεν υπολογίστηκε διαδρομή πεζή';
  const metres = Math.round(leg.route.metres / 10) * 10;
  const distance = metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} ${language === "en" ? "m" : "μ."}`;
  const minutes = Math.max(1, Math.ceil(leg.route.seconds / 60));
  return language === "en" ? `Walk ${distance} · about ${minutes} min` : `Πεζή ${distance} · περίπου ${minutes} λεπτά`;
}
export function walkingFC(legs: WalkingLeg[]): FeatureCollection<LineString> {
  return { type: "FeatureCollection", features: legs.filter(leg => leg.route).map(leg => ({ type: "Feature", properties: {},
    geometry: leg.route!.geometry })) };
}
