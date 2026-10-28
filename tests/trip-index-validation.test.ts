import { describe, expect, it } from "vitest";
import { validateTripIndex } from "../src/lib/trip-index-validation";
import { readFileSync } from "node:fs";

const valid = { v: "v1", s: [["Stop A", 37.9, 23.7], ["Stop B", 38, 23.8]], l: { "320": { a: [0, 1] } } };
describe("trip index validation", () => {
  it("accepts a complete versioned index", () => expect(validateTripIndex(valid)).toBe(valid));
  it("accepts the currently bundled data", () => {
    const current = JSON.parse(readFileSync(new URL("../public/trips.json", import.meta.url), "utf8"));
    expect(validateTripIndex(current).s.length).toBeGreaterThan(0);
  });
  it("rejects missing version and invalid stop coordinates", () => {
    expect(() => validateTripIndex({ ...valid, v: "" })).toThrow();
    expect(() => validateTripIndex({ ...valid, s: [["A", 999, 23]] })).toThrow();
  });
  it("rejects out-of-range or fractional stop references", () => {
    expect(() => validateTripIndex({ ...valid, l: { "320": { a: [0, 2] } } })).toThrow();
    expect(() => validateTripIndex({ ...valid, l: { "320": { a: [0, 0.5] } } })).toThrow();
  });
});
