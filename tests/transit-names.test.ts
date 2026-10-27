import { describe, expect, it } from "vitest";
import { displayName, displayStop, displayText } from "../src/lib/transit-names";
import { directionGroups } from "../src/lib/directions";
import { places, searchPlaces, termini, type TripIndex } from "../src/lib/trip";
import { stopsFC } from "../src/lib/map/layers";
import type { LineStatic } from "../src/lib/types";

const line: LineStatic = { id: "040", stops: {
  a: { name: "ΠΕΙΡΑΙΑΣ", name_en: "PIRAEUS", lat: 37.94, lon: 23.64 },
  b: { name: "ΣΥΝΤΑΓΜΑ", name_en: "SYNTAGMA", lat: 37.97, lon: 23.73 },
}, variants: { out: { headsign: "ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ", direction: 0, shape: [], stops: ["a", "b"] } } };

describe("data-supplied transit names", () => {
  it("uses official English only when requested and nonblank", () => {
    expect(displayName({ name: "ΠΕΙΡΑΙΑΣ", name_en: " PIRAEUS " }, "en")).toBe("PIRAEUS");
    expect(displayName({ name: "ΠΕΙΡΑΙΑΣ", name_en: "PIRAEUS" }, "el")).toBe("ΠΕΙΡΑΙΑΣ");
    expect(displayName({ name: "ΠΕΙΡΑΙΑΣ", name_en: "  " }, "en")).toBe("ΠΕΙΡΑΙΑΣ");
    expect(displayName({ name: "ΣΧΟΛΕΙΑ" }, "en")).toBe("ΣΧΟΛΕΙΑ");
    expect(displayName(undefined, "en")).toBe("");
    expect(displayText("00:10 ΠΕΙΡΑΙΑΣ → ΣΥΝΤΑΓΜΑ", "00:10 PIRAEUS → SYNTAGMA", "en")).toBe("00:10 PIRAEUS → SYNTAGMA");
  });
  it("localizes destination groups while preserving variant identity", () => {
    expect(directionGroups(line, "en")).toEqual([{ to: "SYNTAGMA", variants: ["out"] }]);
    expect(directionGroups(line, "el")[0].to).toBe("ΣΥΝΤΑΓΜΑ");
  });
  it("localizes map stop properties without changing stop IDs or geometry", () => {
    const drawn = { id: "040", color: "#123456", data: line };
    const en = stopsFC(drawn, "out", false, "en");
    const el = stopsFC(drawn, "out", false, "el");
    expect(en.features[0].properties).toMatchObject({ id: "a", name: "PIRAEUS" });
    expect(el.features[0].properties?.name).toBe("ΠΕΙΡΑΙΑΣ");
    expect(en.features.map(f => f.geometry)).toEqual(el.features.map(f => f.geometry));
  });
  it("retains English stop fields in planner places and searches both languages", () => {
    const ix: TripIndex = { v: "v1", s: [["ΠΕΙΡΑΙΑΣ", 37.94, 23.64, "PIRAEUS"], ["ΣΥΝΤΑΓΜΑ", 37.97, 23.73, "SYNTAGMA"]], l: { "040": { out: [0, 1] } } };
    const all = places(ix);
    expect(searchPlaces(all, "Piraeus")[0].label).toBe("ΠΕΙΡΑΙΑΣ");
    expect(searchPlaces(all, "πειραιας")[0].label_en).toBe("PIRAEUS");
    expect(termini(ix, "040", ["out"], "en")).toEqual(["SYNTAGMA"]);
    expect(displayStop(ix.s[0], "en")).toBe("PIRAEUS");
    expect(displayStop(["ΣΧΟΛΕΙΑ", 37.94, 23.64], "en")).toBe("ΣΧΟΛΕΙΑ");
  });
});
