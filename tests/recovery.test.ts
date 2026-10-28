import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/lib/api";
import { AppState } from "../src/lib/state.svelte";
import type { Status } from "../src/lib/types";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("connection recovery checks", () => {
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
