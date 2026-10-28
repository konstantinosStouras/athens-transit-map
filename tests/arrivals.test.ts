import { describe, expect, it } from "vitest";
import { arrivalsFor, parseArrivals } from "../src/lib/arrivals";

const now = 1_800_000_000;
const feed = { source: "realtime", gtfs_version: "v1", stop_index: 7, generated_at: now,
  predictions: [{ line: "1", variant: "out", arrival: now + 180 }, { line: "1", variant: "back", arrival: now + 60 }] };

describe("arrival feed", () => {
  it("rejects untrusted schedules, stale data, and mismatched stop or timetable versions", () => {
    expect(parseArrivals({ ...feed, source: "scheduled" }, "v1", 7, now)).toBeNull();
    expect(parseArrivals({ ...feed, generated_at: now - 121 }, "v1", 7, now)).toBeNull();
    expect(parseArrivals(feed, "v2", 7, now)).toBeNull();
    expect(parseArrivals(feed, "v1", 8, now)).toBeNull();
  });
  it("only returns fresh predictions for the correct direction", () => {
    const parsed = parseArrivals(feed, "v1", 7, now);
    expect(arrivalsFor(parsed, "1", ["out"], now)).toEqual([{ line: "1", variant: "out", arrival: now + 180 }]);
    expect(arrivalsFor(parsed, "1", ["out"], now + 121)).toEqual([]);
  });
});
