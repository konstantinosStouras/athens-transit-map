import { describe, expect, it } from "vitest";
import { closestPoint, walkingDistance, walkingFC, walkingLabel, type WalkingLeg } from "../src/lib/walking";
const leg: WalkingLeg = { from: [38, 23.7], to: [38.001, 23.7], name: "Board here", kind: "board" };
describe("walking connections", () => {
  it("uses proximity internally without presenting it as a walking route", () => {
    expect(walkingDistance(leg)).toBeCloseTo(111.32, 1);
    expect(walkingLabel(leg, "en")).toBe("Walking route not calculated");
    expect(walkingLabel(leg, "el")).toContain("Δεν υπολογίστηκε");
  });
  it("converts to longitude-latitude for the map and clears empty selections", () => {
    expect(walkingFC([leg]).features).toEqual([]);
    expect(walkingFC([]).features).toEqual([]);
  });
  it("draws returned street geometry and uses its distance and duration", () => {
    const routed: WalkingLeg = {...leg,route:{provider:'google',metres:250,seconds:210,geometry:{type:'LineString',coordinates:[[23.7,38],[23.701,38],[23.7,38.001]]}}};
    expect(walkingFC([routed]).features[0].geometry).toEqual(routed.route!.geometry);
    expect(walkingLabel(routed,'en')).toBe('Walk 250 m · about 4 min');
  });
  it("uses the same nearest physical stop as the planner and hides zero-length map links", () => {
    expect(closestPoint([[38,23.7], [38.01,23.7]], [38.009,23.7])).toEqual([38.01,23.7]);
    expect(walkingFC([{...leg,to:leg.from}]).features).toEqual([]);
  });
});
