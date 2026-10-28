import { describe, expect, it } from "vitest";
import { validLiveVehicle } from "../src/lib/live-validation";
import { isLineLive } from "../src/lib/poller";
import type { Vehicle } from "../src/lib/types";

export const sampleVehicle: Vehicle = { id: "bus-1", lat: 37.97, lon: 23.73, bearing: null,
  position_at: 1791100000, route_code: "3923", variant: "5513", trip_id: null,
  trip_label: null, delay_s: null, next_stop_id: null };

describe("selected-line vehicle validation", () => {
  it("accepts older responses without optional motion fields and current geometry", () => {
    expect(validLiveVehicle(sampleVehicle)).toBe(true);
    expect(validLiveVehicle({ ...sampleVehicle, speed: 0, path: [[37.97,23.73],[37.98,23.74]],
      path_beyond: null, path_stops: [0,21], path_speeds: [null,0,8], trip_label_en: null })).toBe(true);
  });
  it.each([null, {}, { ...sampleVehicle, id: "" }, { ...sampleVehicle, lat: 91 },
    { ...sampleVehicle, lon: NaN }, { ...sampleVehicle, position_at: "1791100000" },
    { ...sampleVehicle, trip_label: {} }, { ...sampleVehicle, bearing: Infinity },
    { ...sampleVehicle, variant: [] }, { ...sampleVehicle, delay_s: "late" }])("rejects invalid vehicle records: %j", value => {
    expect(validLiveVehicle(value)).toBe(false);
  });
  it.each([{path:"bad"}, {path:[[37,23],null]}, {path:[[37,23],[91,23]]}, {path_beyond:{}},
    {path_stops:"bad"}, {path_stops:[10,5]}, {path_speeds:[{}]}, {speed:-1}])("rejects geometry that can break animation: %j", fields => {
    expect(validLiveVehicle({ ...sampleVehicle, ...fields })).toBe(false);
  });
  it("rejects the whole corrupt snapshot instead of treating it as no vehicles", () => {
    const feed = { line:"040", updated_at:1791100000, next_update_at:1791100030, vehicles:[sampleVehicle] };
    expect(isLineLive(feed)).toBe(true);
    expect(isLineLive({ ...feed, vehicles:[sampleVehicle,null] })).toBe(false);
    expect(isLineLive({ ...feed, vehicles:[sampleVehicle,sampleVehicle] })).toBe(false);
    expect(isLineLive({ ...feed, vehicles:[] })).toBe(true);
  });
});
