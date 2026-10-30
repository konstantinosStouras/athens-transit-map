import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/api", () => ({
  fetchLineStatic: vi.fn(async () => ({ variants: {}, stops: {} })),
}));
import { emptyChoices } from "../src/lib/choices";
import { AppState } from "../src/lib/state.svelte";
import type { LineLive } from "../src/lib/types";
afterEach(() => vi.unstubAllGlobals());
describe("saved route selections", () => {
  it("clears active and stored selections and returns to the main panel", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
    vi.stubGlobal("location", { pathname: "/", search: "", hash: "" });
    vi.stubGlobal("history", { state: null, replaceState: vi.fn() });
    const app = new AppState();
    app.selected = ["040"]; app.metroLines = ["M1"]; app.focus = { "040": ["out"] };
    app.panelHidden = true; app.panelView = "trip";
    app.journey.from = { text: "Home", place: null };
    app.railChoices.station = "Syntagma";
    app.persistChoices();
    app.clearChoices();
    app.persistChoices();
    const reopened = new AppState();
    expect(reopened.selected).toEqual([]);
    expect(reopened.metroLines).toEqual([]);
    expect(reopened.focus).toEqual({});
    expect(reopened.journey.from.text).toBe("");
    expect(reopened.railChoices.station).toBe("");
    expect(reopened.panelView).toBe("main");
    expect(reopened.panelHidden).toBe(false);
  });
  it("keeps a chosen line after repeated empty service updates", () => {
    const app = new AppState();
    app.selected = ["040"];
    for (const updated_at of [100, 200, 300]) {
      // @ts-expect-error Exercise the poller's private callback without starting network polling.
      app.onData("040", { updated_at, vehicles: [] } as unknown as LineLive);
    }
    expect(app.selected).toEqual(["040"]);
  });
});

it("enables automatic local saving at startup and restores incoming account choices",()=>{
 const values=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
 vi.stubGlobal("location",{pathname:"/",search:"",hash:""});vi.stubGlobal("history",{state:null,replaceState:vi.fn()});
 vi.stubGlobal("window",{addEventListener:vi.fn()});vi.stubGlobal("document",{addEventListener:vi.fn()});vi.stubGlobal("setInterval",vi.fn());
 const app=new AppState();vi.spyOn(app,"retryLines").mockResolvedValue();vi.spyOn(app,"refreshStatus").mockResolvedValue();vi.spyOn(app,"loadMetro").mockImplementation(()=>{});
 app.init();expect(app.choicesReady).toBe(true);
 const c=emptyChoices();c.metroLines=["M3"];c.panelHidden=true;c.panelView="rail";c.rail.station="Syntagma";
 app.applyChoices(c);expect(app.snapshotChoices()).toEqual(c);expect(new AppState().snapshotChoices()).toEqual(c);expect(app.choicesRevision).toBe(1);
});
