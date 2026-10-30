import type { Place } from "./trip";
import { MAX_LINES, selectionIds } from "./selection";
export const CHOICES_KEY = "oasa-choices-v1";
export interface JourneyEnd { text: string; place: Place | null }
export interface JourneyChoices { from: JourneyEnd; to: JourneyEnd; n: number; picked: string | null }
export interface Choices {
  version: 1; selected: string[]; focus: Record<string, string[]>; panelHidden: boolean;
  panelView: "main" | "trip" | "rail" | "stops"; stops: { query: string; radius: number; selected: { name: string; lat: number; lon: number } | null }; journey: JourneyChoices;
  rail: { mode: string; station: string; suburbanStation: string; train: string | null };
}
export const emptyJourney = (): JourneyChoices => ({ from: { text: "", place: null }, to: { text: "", place: null }, n: 3, picked: null });
export const emptyChoices = (): Choices => ({ version: 1, selected: [], focus: {}, panelHidden: false, panelView: "main", stops: { query: "", radius: 500, selected: null }, journey: emptyJourney(),
  rail: { mode: "M1", station: "", suburbanStation: "", train: null } });
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length <= 500;
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 200 && v.every(str);
function end(v: unknown): JourneyEnd {
  if (!obj(v) || !str(v.text)) return { text: "", place: null };
  const p = v.place;
  if (!obj(p) || !str(p.label) || !ids(p.lines) || !Array.isArray(p.pts) || !p.pts.length || p.pts.length > 2000 ||
      !p.pts.every(x => Array.isArray(x) && x.length === 2 && x.every(Number.isFinite) && Math.abs(x[0]) <= 90 && Math.abs(x[1]) <= 180) ||
      (p.kind != null && !["stop", "area", "street", "poi", "me", "metro", "metro-any"].includes(String(p.kind))))
    return { text: v.text, place: null };
  return { text: v.text, place: { label: p.label, pts: p.pts as [number, number][], lines: p.lines,
    ...(str(p.label_en) ? { label_en: p.label_en } : {}), ...(str(p.hint) ? { hint: p.hint } : {}),
    ...(p.kind ? { kind: p.kind as Place["kind"] } : {}) } };
}
export function parseChoices(value: unknown): Choices {
  const c = emptyChoices();
  if (!obj(value) || value.version !== 1) return c;
  if (ids(value.selected)) c.selected = [...new Set(value.selected)].slice(0, MAX_LINES);
  if (obj(value.focus)) c.focus = Object.fromEntries(Object.entries(value.focus).flatMap(([k, v]) => c.selected.includes(k) && ids(v) && v.length ? [[k, v]] : []));
  c.panelHidden = value.panelHidden === true;
  if (value.panelView === "trip" || value.panelView === "rail" || value.panelView === "stops") c.panelView = value.panelView;
  if (obj(value.stops)) {
    const v = value.stops, stop = v.selected;
    c.stops.query = str(v.query) ? v.query : "";
    c.stops.radius = [300, 500, 800, 1500].includes(Number(v.radius)) ? Number(v.radius) : 500;
    if (obj(stop) && str(stop.name) && typeof stop.lat === "number" && typeof stop.lon === "number" &&
        Number.isFinite(stop.lat) && Number.isFinite(stop.lon) && Math.abs(stop.lat) <= 90 && Math.abs(stop.lon) <= 180)
      c.stops.selected = { name: stop.name, lat: stop.lat, lon: stop.lon };
  }
  if (obj(value.journey)) {
    const j = value.journey;
    c.journey = { from: end(j.from), to: end(j.to), n: typeof j.n === "number" && j.n >= 1 && j.n <= 5 ? j.n : 3, picked: str(j.picked) ? j.picked : null };
  }
  if (obj(value.rail)) {
    const r = value.rail;
    c.rail = { mode: ["M1", "M2", "M3", "T6", "T7", "suburban"].includes(String(r.mode)) ? String(r.mode) : "M1",
      station: str(r.station) ? r.station : "", suburbanStation: str(r.suburbanStation) ? r.suburbanStation : "", train: str(r.train) ? r.train : null };
  }
  return c;
}
export function readChoices(): Choices {
  try { return parseChoices(JSON.parse(localStorage.getItem(CHOICES_KEY) ?? "null")); } catch { return emptyChoices(); }
}
export function saveChoices(c: Choices): boolean {
  try { localStorage.setItem(CHOICES_KEY, JSON.stringify(c)); return true; } catch { return false; }
}
export function clearSavedChoices(): void {
  try { localStorage.removeItem(CHOICES_KEY); } catch { /* storage unavailable */ }
}
export function resolveChoices(c: Choices, search: string): Choices {
  if (!new URLSearchParams(search).has("l")) return c;
  const selected = selectionIds(search).slice(0, MAX_LINES);
  // Explicit shared links take priority. Refreshing the same link retains the journey.
  return selected.join() === c.selected.join() ? c : { ...c, selected, focus: {}, journey: emptyJourney(), panelView: "main", panelHidden: false };
}
