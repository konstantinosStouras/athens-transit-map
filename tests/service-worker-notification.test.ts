import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

describe("notification navigation", () => {
  it("focuses the map instead of an unrelated page", async () => {
    const listeners: Record<string, (event: any) => void> = {};
    const focus = vi.fn();
    const openWindow = vi.fn();
    const self = {
      addEventListener: (name: string, cb: (event: any) => void) => { listeners[name] = cb; },
      registration: { scope: "https://example.com/athens-transit-map/" },
      clients: { matchAll: async () => [
        { url: "https://example.com/other/", focus: vi.fn() },
        { url: "https://example.com/athens-transit-map/feedback.html", focus: vi.fn() },
        { url: "https://example.com/athens-transit-map/?lang=en", focus },
      ], openWindow },
    };
    runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, URL });
    let pending: Promise<unknown> = Promise.resolve();
    listeners.notificationclick({ notification: { close: vi.fn() }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens the map when only unrelated pages are open", async () => {
    const listeners: Record<string, (event: any) => void> = {};
    const openWindow = vi.fn();
    const self = {
      addEventListener: (name: string, cb: (event: any) => void) => { listeners[name] = cb; },
      registration: { scope: "https://example.com/athens-transit-map/" },
      clients: { matchAll: async () => [{ url: "https://example.com/athens-transit-map/feedback.html", focus: vi.fn() }], openWindow },
    };
    runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, URL });
    let pending: Promise<unknown> = Promise.resolve();
    listeners.notificationclick({ notification: { close: vi.fn() }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(openWindow).toHaveBeenCalledWith("https://example.com/athens-transit-map/");
  });
});
