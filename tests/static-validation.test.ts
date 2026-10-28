import { describe, expect, it, vi, afterEach } from "vitest";
import { validLineStatic, validStatus } from "../src/lib/static-validation";
import { fetchLineStatic, fetchStatus } from "../src/lib/api";
const route = { id: "test-static", variants: { v: { headsign: "End", direction: 0, shape: [[38, 23.7], [38.1, 23.8]], stops: ["a"] } }, stops: { a: { name: "Stop", lat: 38, lon: 23.7 } } };
afterEach(() => vi.unstubAllGlobals());
describe("static API boundaries", () => {
  it("accepts complete routes and empty known-line geometry", () => {
    expect(validLineStatic(route, "test-static")).toBe(true);
    expect(validLineStatic({ id: "1", variants: {}, stops: {} }, "1")).toBe(true);
  });
  it("rejects the wrong line, null stops, dangling stop ids and invalid coordinates", () => {
    expect(validLineStatic(route, "550")).toBe(false);
    expect(validLineStatic({ ...route, stops: { a: null } }, route.id)).toBe(false);
    expect(validLineStatic({ ...route, stops: {} }, route.id)).toBe(false);
    expect(validLineStatic({ ...route, stops: { a: { name: "Bad", lat: 100, lon: 23 } } }, route.id)).toBe(false);
    expect(validLineStatic({ ...route, variants: { v: { ...route.variants.v, shape: [["38", 23]] } } }, route.id)).toBe(false);
  });
  it("does not cache a corrupt response and deduplicates the successful retry", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: route.id, variants: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify(route)));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchLineStatic(route.id)).rejects.toThrow("Invalid route");
    expect(await fetchLineStatic(route.id)).toEqual(route);
    expect(await fetchLineStatic(route.id)).toEqual(route);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("never reports an HTML/error-shaped HTTP 200 status body as healthy", async () => {
    expect(validStatus({ ok: true })).toBe(false);
    const status = { ok: false, gtfs_version: "v", gtfs_expires: "2026-10-06", updated_at: 1793177160, lines_active: 0, budget_rps: 5 };
    expect(validStatus(status)).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "unavailable" }))));
    expect(await fetchStatus()).toBeNull();
  });
});
