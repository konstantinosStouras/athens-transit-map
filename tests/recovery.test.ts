import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/lib/api";
import { AppState } from "../src/lib/state.svelte";
import type { Status } from "../src/lib/types";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("connection recovery checks", () => {
  it("recovers missing route geometry with paced, deduplicated retries", async () => {
    vi.useFakeTimers();
    const shape = { id: "040", stops: {}, variants: {} };
    const fetcher = vi.spyOn(api, "fetchLineStatic").mockRejectedValueOnce(new Error("offline")).mockResolvedValue(shape);
    const app = new AppState();
    await app.retryStatic("040");
    expect(app.staticFailed["040"]).toBe(true);
    await app.retryStatic("040");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    await Promise.all([app.retryStatic("040"), app.retryStatic("040")]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(app.staticFailed["040"]).toBe(false);
    expect(app.statics["040"]).toEqual(shape);
    await app.retryStatic("040");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("recovers a failed line index without removing a selected line", async () => {
    const lines = vi.spyOn(api, "fetchLines").mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      gtfs_version: "v1", lines: [{ id: "040", name: "Line 040", name_en: "Line 040", color: "#123456", text_color: "#ffffff", kind: "bus" }],
    });
    const app = new AppState();
    app.selected = ["040"];
    await app.retryLines();
    expect(app.linesFailed).toBe(true);
    expect(app.selected).toEqual(["040"]);
    await app.retryLines();
    expect(lines).toHaveBeenCalledTimes(2);
    expect(app.linesFailed).toBe(false);
    expect(app.lineInfo.has("040")).toBe(true);
    expect(app.selected).toEqual(["040"]);
  });

  it("retries the line list on a connection check and deduplicates in-flight requests", async () => {
    let finish!: (value: Awaited<ReturnType<typeof api.fetchLines>>) => void;
    const lines = vi.spyOn(api, "fetchLines").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.spyOn(api, "fetchStatus").mockResolvedValue(null);
    const app = new AppState();
    app.linesFailed = true;
    const check = app.checkConnection();
    await app.retryLines();
    expect(lines).toHaveBeenCalledTimes(1);
    finish({ gtfs_version: "v1", lines: [{ id: "1", name: "Line 1", name_en: "Line 1", color: "#123456", text_color: "#fff", kind: "trolley" }] });
    await check;
    expect(app.linesFailed).toBe(false);
  });
  it("times out a stalled status check and allows another check", async () => {
    vi.useFakeTimers();
    const fetchStatus = vi.spyOn(api, "fetchStatus").mockImplementation(signal => new Promise(resolve => {
      signal!.addEventListener("abort", () => resolve(null), { once: true });
    }));
    const app = new AppState();
    const check = app.checkConnection();
    await vi.advanceTimersByTimeAsync(15_000);
    await check;
    expect(app.statusFailed).toBe(true);
    expect(app.statusChecking).toBe(false);
    fetchStatus.mockResolvedValue(null);
    await app.checkConnection();
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });
  it("deduplicates concurrent checks, preserves old metadata on failure, and throttles retries", async () => {
    vi.useFakeTimers();
    const previous: Status = { ok: true, gtfs_version: "old", gtfs_expires: "2026-07-31", updated_at: 100, lines_active: 20, budget_rps: 5 };
    let finish!: (s: Status | null) => void;
    const fetchStatus = vi.spyOn(api, "fetchStatus").mockImplementation(() => new Promise(r => { finish = r; }));
    const app = new AppState();
    app.status = previous;
    const first = app.checkConnection();
    expect(app.statusChecking).toBe(true);
    await app.checkConnection();
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    finish(null);
    await first;
    expect(app.statusChecking).toBe(false);
    expect(app.statusFailed).toBe(true);
    expect(app.status).toEqual(previous);
    await app.checkConnection();
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    fetchStatus.mockResolvedValue({ ...previous, updated_at: 200 });
    await app.checkConnection();
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(app.statusFailed).toBe(false);
    expect(app.status?.updated_at).toBe(200);
  });
});
