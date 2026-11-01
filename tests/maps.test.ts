import { describe, expect, it } from "vitest";
import { walkUrl, appleWalkUrl } from "../src/lib/maps";

describe("walkUrl", () => {
  it("opens Google Maps walking directions from where the phone is", () => {
    expect(walkUrl([37.98123456, 23.7])).toBe("https://www.google.com/maps/dir/?api=1&destination=37.981235%2C23.7&travelmode=walking");
  });
  it("starts at a given point", () => {
    expect(walkUrl([37.98, 23.7], [38, 23.71])).toBe("https://www.google.com/maps/dir/?api=1&origin=38%2C23.71&destination=37.98%2C23.7&travelmode=walking");
  });
});

describe("Apple walking directions", () => {
  it("uses current location when no origin is supplied", () => {
    const url = new URL(appleWalkUrl([37.98, 23.7]));
    expect(url.origin).toBe("https://maps.apple.com");
    expect(url.searchParams.get("mode")).toBe("walking");
    expect(url.searchParams.has("source")).toBe(false);
    expect(url.searchParams.get("destination")).toBe("37.98,23.7");
  });
  it("preserves the transfer and final-walk origins, not the user's location", () => {
    for (const builder of [appleWalkUrl, walkUrl]) {
      const url = new URL(builder([37.98, 23.7], [37.97, 23.71]));
      expect(url.searchParams.get(builder === appleWalkUrl ? "source" : "origin")).toBe("37.97,23.71");
      expect(url.searchParams.get("destination")).toBe("37.98,23.7");
    }
  });
});
