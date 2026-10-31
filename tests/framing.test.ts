import { describe, expect, it } from "vitest";
import { selectionBounds } from "../src/lib/map/framing";
import type { DrawnLine } from "../src/lib/map/layers";
import type { MetroLine } from "../src/lib/metro";
import type { LineStatic } from "../src/lib/types";

const bus = (id: string, shape: [number, number][]): DrawnLine => ({
  id, color: "red", data: { variants: { outward: { shape } } } as unknown as LineStatic,
});
const buses = [bus("A", [[38, 23], [39, 24]]), bus("B", [[37, 22], [38, 23]])];
const rail: MetroLine[] = [
  { id: "M1", name: "One", color: "green", paths: [[[24, 40], [25, 41]], [[26, 42], [25, 41]]] },
  { id: "M2", name: "Two", color: "red", paths: [[[21, 36], [22, 37]]] },
];

describe("selected route framing", () => {
  it("includes every bus, every rail path and a location outside the network", () => {
    expect(selectionBounds(buses, rail, [20, 43])).toEqual([[20, 36], [26, 43]]);
    expect(selectionBounds([...buses].reverse(), [...rail].reverse(), [20, 43])).toEqual([[20, 36], [26, 43]]);
  });
  it("frames multiple buses without metro routes", () => {
    expect(selectionBounds(buses, [], [27, 35])).toEqual([[22, 35], [27, 39]]);
  });
  it("frames multiple metro routes without buses", () => {
    expect(selectionBounds([], rail, [20, 43])).toEqual([[20, 36], [26, 43]]);
  });
  it("shrinks to remaining selections and respects direction filters", () => {
    expect(selectionBounds([{ ...buses[0], visible: new Set() }, buses[1]], [rail[1]], [23, 38]))
      .toEqual([[21, 36], [23, 38]]);
  });
  it("includes routes before GPS arrives, then expands for the first fix", () => {
    expect(selectionBounds(buses, rail)).toEqual([[21, 36], [26, 42]]);
    expect(selectionBounds(buses, rail, [20, 43])).toEqual([[20, 36], [26, 43]]);
  });
  it("does not override the location view when no route geometry is loaded", () => {
    expect(selectionBounds([], [], [23, 38])).toBeNull();
  });
  it("drops removed bus and metro extents while retaining the current location", () => {
    const before = selectionBounds(buses, rail, [23, 38]);
    expect(before).toEqual([[21, 36], [26, 42]]);
    expect(selectionBounds(buses, [rail[1]], [23, 38])).toEqual([[21, 36], [24, 39]]);
    expect(selectionBounds([buses[1]], [rail[1]], [23, 38])).toEqual([[21, 36], [23, 38]]);
    expect(selectionBounds([buses[1]], [], [25, 40])).toEqual([[22, 37], [25, 40]]);
    // Repeated refits and removals must not mutate a prior camera extent.
    expect(before).toEqual([[21, 36], [26, 42]]);
  });
});
