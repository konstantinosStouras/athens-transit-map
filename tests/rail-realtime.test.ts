import { describe, expect, it } from "vitest";
import { parseRailFeed, railVehicleFC } from "../src/lib/rail-realtime";

const now = 1_800_000_000;
const lines = new Set(["M1", "T6"]);
const vehicle = { id: "train-1", line: "M1", lat: 37.98, lon: 23.72, position_at: now };
const feed = { source: "realtime", generated_at: now, vehicles: [vehicle] };
describe("optional rail live data", () => {
  it("rejects scheduled, expired, future and malformed feeds", () => {
    expect(parseRailFeed({ ...feed, source: "scheduled" }, lines, now)).toBeNull();
    expect(parseRailFeed({ ...feed, generated_at: now - 121 }, lines, now)).toBeNull();
    expect(parseRailFeed({ ...feed, generated_at: now + 31 }, lines, now)).toBeNull();
    expect(parseRailFeed({ ...feed, vehicles: null }, lines, now)).toBeNull();
  });
  it("only plots known lines with fresh plausible positions, and removes stale data", () => {
    const parsed = parseRailFeed({ ...feed, vehicles: [vehicle, vehicle, { ...vehicle, line: "T7" }, { ...vehicle, id: "old", position_at: now - 121 }, { ...vehicle, id: "far", lat: 0 }] }, lines, now)!;
    expect(parsed.vehicles).toEqual([vehicle]);
    expect(railVehicleFC(parsed, ["T6"], now).features).toHaveLength(0);
    expect(railVehicleFC(parsed, ["M1"], now).features).toHaveLength(1);
    expect(railVehicleFC(parsed, ["M1"], now + 121).features).toHaveLength(0);
  });
});
