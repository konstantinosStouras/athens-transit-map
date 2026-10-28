import { describe, expect, it } from "vitest";
import { officialArrivalsUrl, officialStopCode } from "../src/lib/official-arrivals";
import type { StopPoint } from "../src/lib/stops";
import type { LineStatic } from "../src/lib/types";

const stop: StopPoint = { id: 7, name: "ΣΤ. ΣΥΓΓΡΟΥ-ΦΙΞ", lat: 37.96447, lon: 23.72644,
  services: [{ line: "040", variant: "5513", destination: "ΠΕΙΡΑΙΑΣ", boarding: true }] };
const line: LineStatic = { id: "040", stops: { "60806": { name: stop.name, lat: stop.lat, lon: stop.lon },
  "60814": { name: stop.name, lat: stop.lat + 0.00005, lon: stop.lon } },
  variants: { "5513": { headsign: "ΠΕΙΡΑΙΑΣ", direction: 1, shape: [], stops: ["60806"] },
    "5512": { headsign: "ΣΥΝΤΑΓΜΑ", direction: 0, shape: [], stops: ["60814"] } } };

describe("official arrival stop links", () => {
  it("uses the physical stop in the selected direction, not the nearby opposite stop", () => {
    expect(officialStopCode(stop, line)).toBe("60806");
    expect(officialStopCode({ ...stop, services: [{ ...stop.services[0], variant: "5512" }] }, line)).toBe("60814");
  });
  it("refuses ambiguous, missing and mismatched routes and distant or renamed stops", () => {
    expect(officialStopCode(stop, { ...line, id: "550" })).toBeNull();
    expect(officialStopCode(stop, { ...line, variants: {} })).toBeNull();
    expect(officialStopCode(stop, { ...line, variants: { "5513": { ...line.variants["5513"], stops: ["60806", "60814"] } } })).toBeNull();
    expect(officialStopCode({ ...stop, lat: 38 }, line)).toBeNull();
    expect(officialStopCode({ ...stop, name: "ΑΛΛΗ ΣΤΑΣΗ" }, line)).toBeNull();
    expect(officialStopCode({ ...stop, services: [...stop.services, { ...stop.services[0], variant: "5512" }] }, line)).toBeNull();
  });
  it("links to the official stop code rather than a compact index or printed StopID", () => {
    const url = officialArrivalsUrl(stop, "60806", "en");
    expect(url).toBe(`https://telematics.oasa.gr/en/#stationInfo_60806_${encodeURIComponent(stop.name)}_37.96447,23.72644`);
    expect(officialArrivalsUrl(stop, "60806", "el")).toContain("oasa.gr/#stationInfo_60806_");
  });
  it("falls back to official search for invalid codes or coordinates", () => {
    for (const code of [null, "", "../../x", "60806_other", "<script>"]) expect(officialArrivalsUrl(stop, code, "en")).toBe("https://telematics.oasa.gr/en/");
    for (const lat of [NaN, Infinity, 0, 90]) expect(officialArrivalsUrl({ ...stop, lat }, "60806", "en")).toBe("https://telematics.oasa.gr/en/");
  });
  it("keeps labels from injecting hash fields or markup into the destination", () => {
    const url = officialArrivalsUrl({ ...stop, name: '<img_onerror="x">#&', name_en: "English_stop" }, "60806", "en");
    expect(url).toContain("_English%20stop_");
    expect(url.split("_")).toHaveLength(4);
  });
});
