import { describe, expect, it } from "vitest";
import { closestPoint, walkingDistance, walkingFC, walkingLabel, type WalkingLeg } from "../src/lib/walking";
const leg: WalkingLeg = { from: [38, 23.7], to: [38.001, 23.7], name: "Board here", kind: "board" };
describe("walking connections", () => {
  it("uses known coordinates and labels a straight-line estimate in either language", () => {
    expect(walkingDistance(leg)).toBeCloseTo(111.32, 1);
    expect(walkingLabel(leg, "en")).toBe("Walk ≈ 110 m · straight line");
    expect(walkingLabel(leg, "el")).toContain("σε ευθεία");
  });
  it("converts to longitude-latitude for the map and clears empty selections", () => {
    expect(walkingFC([leg]).features[0].geometry.coordinates).toEqual([[23.7,38],[23.7,38.001]]);
    expect(walkingFC([]).features).toEqual([]);
  });
  it("uses the same nearest physical stop as the planner and hides zero-length map links", () => {
    expect(closestPoint([[38,23.7], [38.01,23.7]], [38.009,23.7])).toEqual([38.01,23.7]);
    expect(walkingFC([{...leg,to:leg.from}]).features).toEqual([]);
  });
});
