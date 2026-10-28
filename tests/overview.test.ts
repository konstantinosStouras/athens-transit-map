import { describe, expect, it } from "vitest";
import { overview } from "../src/lib/overview";

describe("live overview measurement coverage", () => {
  it("excludes old GPS and unknown delays from the on-time denominator", () => {
    const result = overview([
      { position_at: 990, delay_s: -60, speed: 10 },
      { position_at: 980, delay_s: 120, speed: 0 },
      { position_at: 980, delay_s: 121, speed: 5 },
      { position_at: 980, delay_s: null, speed: null },
      { position_at: 800, delay_s: 600, speed: 50 },
    ], 1000);
    expect(result).toEqual({ total: 5, fresh: 4, stale: 1, measured: 3, unknown: 1, onTime: 2, late: 1, maxKmh: 36, speedSamples: 3 });
  });
  it("does not turn missing, invalid or future measurements into real zeroes", () => {
    expect(overview([], 1000).maxKmh).toBeNull();
    const result = overview([
      { position_at: 0, delay_s: 0, speed: 80 },
      { position_at: 1100, delay_s: 0, speed: 90 },
      { position_at: NaN, delay_s: 0, speed: 100 },
      { position_at: 990, delay_s: NaN, speed: Infinity },
      { position_at: 990, delay_s: null, speed: -1 },
    ], 1000);
    expect(result).toMatchObject({ fresh: 2, stale: 3, measured: 0, unknown: 2, maxKmh: null, speedSamples: 0 });
    expect(overview([{ position_at: 990, delay_s: 0, speed: 0 }], 1000).maxKmh).toBe(0);
  });
});
