import { API_BASE } from "./config";

export interface RailStation { id: string; name: string; corridors: string[] }
export interface Departure {
  line?: string; headsign?: string; in_s?: number;
  train?: string; from?: string; to?: string; delay_min?: number | null;
  platform?: string | null; status?: string; t: string;
}
export interface DepartureBoard { indicative?: boolean; departures: Departure[] }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
export function parseBoard(value: unknown, suburban: boolean): DepartureBoard {
  if (!record(value) || !Array.isArray(value.departures) ||
    (!suburban && typeof value.indicative !== "boolean")) throw new Error("Invalid rail board");
  const departures = value.departures.filter((d): d is Departure => record(d) && typeof d.t === "string" &&
    (suburban ? typeof d.train === "string" && typeof d.to === "string" &&
      (d.delay_min == null || typeof d.delay_min === "number" && Number.isFinite(d.delay_min)) &&
      (d.platform == null || typeof d.platform === "string") && typeof d.status === "string" :
      typeof d.line === "string" && typeof d.headsign === "string" && typeof d.in_s === "number" && Number.isFinite(d.in_s)));
  if (departures.length !== value.departures.length) throw new Error("Invalid rail departure");
  return { indicative: value.indicative === true, departures };
}
export function parseStations(value: unknown): RailStation[] {
  if (!record(value) || !Array.isArray(value.stations)) throw new Error("Invalid rail stations");
  return value.stations.filter((s): s is RailStation => record(s) && typeof s.id === "string" &&
    typeof s.name === "string" && Array.isArray(s.corridors) && s.corridors.every(c => typeof c === "string"));
}
export const railBoardUrl = (stop: string, suburban = false) => suburban
  ? `${API_BASE}/v1/rail/suburban/stations/${encodeURIComponent(stop)}/departures?n=10`
  : `${API_BASE}/v1/rail/stasy/departures?stop=${encodeURIComponent(stop)}&n=6`;
export async function railJSON(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Rail HTTP ${response.status}`);
  return response.json();
}
export const railStationsUrl = `${API_BASE}/v1/rail/suburban/stations`;
