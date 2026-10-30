import { describe, expect, it } from "vitest";
import { trainPositions } from "../src/lib/train-positions";
const now = 1000;
describe("official train feeds", () => {
  it("marks STASY positions as estimates and interpolates only the supplied interval", () => {
    const v = { trip: "a", line: "M1", headsign: "Piraeus", from: { name: "A", lat: 38, lon: 23.7, at: 900 }, to: { name: "B", lat: 38.02, lon: 23.72, at: 1100 } };
    const feed = { updated_at: now, indicative: true, vehicles: [v] };
    const result = trainPositions(feed, "M1", now)[0];
    expect(result).toMatchObject({ estimated: true, indicative: true });
    expect(result.point[0]).toBeCloseTo(38.01);
    expect(result.point[1]).toBeCloseTo(23.71);
    expect(trainPositions(feed, "M2", now)).toEqual([]);
    expect(trainPositions({ ...feed, updated_at: 1200 }, "M1", 1200)).toEqual([]);
  });
  it("uses only fresh suburban GPS fixes in the Athens region", () => {
    const v = { train: "1226", service: "Suburban", to: "Airport", lat: 38.04, lon: 23.73, position_at: now, delay_min: null };
    const feed = { updated_at: now, trains: [v, { ...v, train: "old", position_at: 500 }, { ...v, train: "far", lat: 40.6 }, { ...v, train: "invalid", lon: NaN }] };
    expect(trainPositions(feed, "suburban", now)).toHaveLength(1);
    expect(trainPositions(feed, "suburban", now)[0]).toMatchObject({ estimated: false, delay: null, point: [38.04, 23.73] });
  });
  it("rejects stale, future and malformed feeds without inventing trains", () => {
    for (const value of [{}, { updated_at: 500, trains: [] }, { updated_at: 2000, trains: [] }, { updated_at: now }])
      expect(() => trainPositions(value, "suburban", now)).toThrow();
    expect(trainPositions({ updated_at: now, trains: [] }, "suburban", now)).toEqual([]);
  });
});
