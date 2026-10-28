import { describe, expect, it } from "vitest";
import { trafficTileTemplate } from "../src/lib/traffic";

describe("traffic tile configuration", () => {
  it("requires a secure XYZ template", () => {
    expect(trafficTileTemplate(undefined)).toBeNull();
    expect(trafficTileTemplate("http://tiles.example/{z}/{x}/{y}.png")).toBeNull();
    expect(trafficTileTemplate("https://tiles.example/{z}/{x}.png")).toBeNull();
    expect(trafficTileTemplate(" https://tiles.example/{z}/{x}/{y}.png ")).toBe("https://tiles.example/{z}/{x}/{y}.png");
  });
});
