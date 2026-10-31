import { expect, it } from "vitest";
import { journeyLines, type JourneyLeg } from "../src/lib/map/journey";
import { bounds, routesFC, type DrawnLine } from "../src/lib/map/layers";

const shape: [number, number][] = [[38, 23], [38, 23.01], [38, 23.02], [38, 23.03], [38, 23.04]];
const line: DrawnLine = { id: "130", color: "blue", data: { id: "130",
  variants: { out: { headsign: "End", direction: 0, shape, stops: ["a", "b", "c", "d", "e"] },
    back: { headsign: "Start", direction: 1, shape: [...shape].reverse(), stops: ["e", "d", "c", "b", "a"] } },
  stops: Object.fromEntries(shape.map(([lat, lon], i) => ["abcde"[i], { name: "abcde"[i], lat, lon }])) } };
const leg: JourneyLeg = { line: "130", variant: "out", i: 1, j: 3, from: shape[1], to: shape[3] };

it("frames only the boarding-to-exit section, preserving bends and source data", () => {
  const result = journeyLines([line], [leg]);
  const frame = bounds(result)!;
  expect(frame[0][0]).toBeCloseTo(23.01);
  expect(frame[1][0]).toBeCloseTo(23.03);
  expect(result[0].data.variants.out.shape).toContainEqual(shape[2]);
  expect(result[0].data.variants.out.stops).toEqual(["b", "c", "d"]);
  expect(routesFC(result).features).toHaveLength(1);
  expect(line.data.variants.out.shape).toHaveLength(5);
});
it("keeps only the chosen legs and correctly clips the opposite direction", () => {
  const other = { ...line, id: "Α2" };
  const result = journeyLines([line, other], [{ ...leg, variant: "back", from: shape[3], to: shape[1] }]);
  expect(result.map(l => l.id)).toEqual(["130"]);
  expect(result[0].data.variants.back.shape[0][1]).toBeCloseTo(23.03);
  expect(result[0].data.variants.back.shape.at(-1)![1]).toBeCloseTo(23.01);
});
it("never substitutes a full route or invented straight line when stops no longer match", () => {
  expect(bounds(journeyLines([line], [{ ...leg, from: [37, 22] }]))).toBeNull();
  expect(journeyLines([line], [{ ...leg, variant: "missing" }])).toEqual([]);
});
it("restores full routes when the chosen journey is cleared", () => {
  expect(journeyLines([line], [])).toEqual([line]);
});
it("combines the selected sections of both transfer lines without their unused tails", () => {
  const other = { ...line, id: "Α2" };
  const result = journeyLines([line, other], [leg, { ...leg, line: "Α2", i: 2, from: shape[2] }]);
  expect(result.map(l => l.id)).toEqual(["130", "Α2"]);
  expect(bounds(result)![0][0]).toBeCloseTo(23.01);
  expect(bounds(result)![1][0]).toBeCloseTo(23.03);
  expect(result[1].data.variants.out.stops).toEqual(["c", "d"]);
});
