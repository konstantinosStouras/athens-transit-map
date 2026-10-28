import { describe, expect, it } from "vitest";
import { validLinesIndex } from "../src/lib/api";

describe("line index validation", () => {
  it("accepts a versioned line index", () => {
    expect(validLinesIndex({ gtfs_version: "v1", lines: [{ id: "040", name: "Line" }] })).toBe(true);
  });
  it("rejects empty, malformed, or unversioned lists", () => {
    expect(validLinesIndex({ gtfs_version: "v1", lines: [] })).toBe(false);
    expect(validLinesIndex({ gtfs_version: "", lines: [{ id: "040", name: "Line" }] })).toBe(false);
    expect(validLinesIndex({ gtfs_version: "v1", lines: [{ id: "", name: "Line" }] })).toBe(false);
  });
});
