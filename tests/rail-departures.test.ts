import { describe, it, expect } from "vitest";
import { parseBoard, parseStations, railBoardUrl } from "../src/lib/rail-departures";

describe("released rail departure contracts", () => {
  it("preserves indicative STASY times without presenting them as live positions", () => {
    const d = { line: "M1", headsign: "ΚΗΦΙΣΙΑ", t: "14:05", in_s: 240 };
    expect(parseBoard({ indicative: true, departures: [d] }, false)).toEqual({ indicative: true, departures: [d] });
    expect(() => parseBoard({ departures: [d] }, false)).toThrow();
  });
  it("retains unknown delays and platform information", () => {
    const d = { train: "1203", to: "Κιάτο", t: "05:32", delay_min: null, platform: "4", status: "scheduled" };
    expect(parseBoard({ departures: [d] }, true).departures[0].delay_min).toBeNull();
    expect(() => parseBoard({ departures: [{ ...d, delay_min: "5" }] }, true)).toThrow();
    expect(() => parseBoard({}, true)).toThrow();
    expect(parseBoard({ departures: [] }, true).departures).toEqual([]);
  });
  it("uses provider station identities and encodes URL parameters", () => {
    expect(parseStations({ stations: [{ id: "abc", name: "Αθήνα", corridors: ["PIRAIR"] }, { id: 1 }] })).toHaveLength(1);
    expect(railBoardUrl("A&B")).toContain("stop=A%26B&n=6");
    expect(railBoardUrl("a/b", true)).toContain("stations/a%2Fb/departures");
  });
});
