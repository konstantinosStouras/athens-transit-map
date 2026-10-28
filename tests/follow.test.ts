import { describe, expect, it } from "vitest";
import { needsRecenter } from "../src/lib/map/follow";

describe("location follow redraws", () => {
  it("skips stationary and subpixel GPS changes", () => {
    expect(needsRecenter({ x: 25, y: 40 }, { x: 25, y: 40 })).toBe(false);
    expect(needsRecenter({ x: 25.2, y: 40.2 }, { x: 25, y: 40 })).toBe(false);
  });

  it("recenters when the displayed location visibly moves", () => {
    expect(needsRecenter({ x: 25.5, y: 40.4 }, { x: 25, y: 40 })).toBe(true);
  });
});
