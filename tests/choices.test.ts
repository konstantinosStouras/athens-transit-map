import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeChoices, encodeChoices, MAX_CLOUD_CHOICES, CHOICES_KEY, clearSavedChoices, emptyChoices, parseChoices, readChoices, resolveChoices, saveChoices } from "../src/lib/choices";
afterEach(() => vi.unstubAllGlobals());
function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  return values;
}
describe("remembered choices", () => {
  it("restores a station opened directly with all its services", () => {
    storage();
    const c = emptyChoices();
    c.panelView = "rail";
    c.rail.mode = "station";
    c.rail.station = "Πικροδάφνη";
    saveChoices(c);
    expect(readChoices()).toEqual(c);
    expect(decodeChoices(encodeChoices(c))).toEqual(c);
  });
  it("restores routes, endpoints, chosen journey and collapsed panels after a fresh read", () => {
    storage();
    const c = emptyChoices();
    c.selected = ["040", "550"]; c.focus = { "040": ["out"] }; c.panelHidden = true; c.panelView = "trip";
    c.journey.from = { text: "Home", place: { label: "Home", pts: [[37.98, 23.73]], lines: [], kind: "area" } };
    c.journey.to = { text: "Airport", place: { label: "Airport", pts: [[37.94, 23.94]], lines: ["M3"], kind: "metro" } };
    c.journey.picked = "040"; c.rail = { mode: "suburban", station: "", suburbanStation: "athens", train: "1226" };
    expect(saveChoices(c)).toBe(true);
    expect(readChoices()).toEqual(c);
  });
  it("remembers stop searches and the selected boarding stop", () => {
    storage();
    const c = emptyChoices();
    c.panelView = "stops";
    c.stops = { query: "Syntagma", radius: 800, selected: { name: "Syntagma", lat: 37.98, lon: 23.73 } };
    saveChoices(c);
    expect(readChoices().stops).toEqual(c.stops);
    expect(readChoices().panelView).toBe("stops");
  });
  it("clears saved choices while preserving unrelated browser data", () => {
    const values = storage();
    values.set("oasa-language", "en");
    const c = emptyChoices(); c.selected = ["040"]; saveChoices(c);
    clearSavedChoices();
    expect(values.has(CHOICES_KEY)).toBe(false);
    expect(readChoices()).toEqual(emptyChoices());
    expect(values.get("oasa-language")).toBe("en");
  });
  it("uses saved choices on a plain visit and the explicit lines in a shared link", () => {
    const c = emptyChoices(); c.selected = ["040"]; c.panelHidden = true; c.panelView = "trip"; c.focus = { "040": ["out"] };
    expect(resolveChoices(c, "?lang=en")).toEqual(c);
    expect(resolveChoices(c, "?l=040")).toEqual(c);
    expect(resolveChoices(c, "?l=550")).toMatchObject({ selected: ["550"], focus: {}, panelHidden: false, panelView: "main" });
    expect(resolveChoices(c, "?l=")).toMatchObject({ selected: [], panelView: "main" });
  });
  it("rejects corrupt or unsupported snapshots and invalid coordinates", () => {
    const values = storage(); values.set(CHOICES_KEY, "{bad");
    expect(readChoices()).toEqual(emptyChoices());
    expect(parseChoices({ version: 2, selected: ["040"] })).toEqual(emptyChoices());
    const c = emptyChoices(); c.journey.from = { text: "bad", place: { label: "bad", pts: [[200, 0]], lines: [] } };
    expect(parseChoices(c).journey.from.place).toBeNull();
    expect(parseChoices({ ...c, selected: ["040", "040"], focus: { "550": ["out"] } })).toMatchObject({ selected: ["040"], focus: {} });
  });
  it("continues without crashing when storage is blocked or full", () => {
    vi.stubGlobal("localStorage", { getItem() { throw Error("blocked"); }, setItem() { throw Error("full"); }, removeItem() { throw Error("blocked"); } });
    expect(readChoices()).toEqual(emptyChoices());
    expect(saveChoices(emptyChoices())).toBe(false);
    expect(() => clearSavedChoices()).not.toThrow();
  });
});

it("encodes nested journey coordinates and rail layers for cloud storage",()=>{
 const c=emptyChoices();c.metroLines=["M1","T7"];c.stationsOn=true;
 c.journey.to={text:"Destination",place:{label:"Destination",pts:[[37.98,23.73],[37.99,23.74]],lines:[]}};
 expect(decodeChoices(encodeChoices(c))).toEqual(c);
 expect(decodeChoices("{" )).toBeNull();expect(decodeChoices(JSON.stringify({version:2}))).toBeNull();expect(decodeChoices("x".repeat(MAX_CLOUD_CHOICES+1))).toBeNull();
});
it("migrates the existing separately saved rail selections",()=>{
 const values=storage();values.set("metroLines",JSON.stringify(["M3"]));values.set("stationsOn","true");
 expect(readChoices()).toMatchObject({metroLines:["M3"],stationsOn:true});
 saveChoices(emptyChoices());expect(readChoices()).toEqual(emptyChoices());
});
