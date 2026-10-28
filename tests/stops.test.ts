import { describe, expect, it } from "vitest";
import { approachingStop, findStops, indexStops } from "../src/lib/stops";
import type { TripIndex } from "../src/lib/trip";
import type { LineLive, LineStatic, Vehicle } from "../src/lib/types";

const ix: TripIndex = { v: "v1", s: [["ΑΡΧΗ",38,23,"Start"],["ΣΤΑΣΗ",38.001,23,"Stop"],["ΣΤΑΣΗ",38.001,23.0002,"Stop"],["ΤΕΛΟΣ",38.002,23,"End"]], l: { "040": { out:[0,1,3], back:[3,2,0] } } };
const st: LineStatic = { id:"040", stops:{ a:{name:"ΑΡΧΗ",lat:38,lon:23}, b:{name:"ΣΤΑΣΗ",lat:38.001,lon:23}, c:{name:"ΣΤΑΣΗ",lat:38.001,lon:23.0002}, d:{name:"ΤΕΛΟΣ",lat:38.002,lon:23} }, variants:{ out:{ headsign:"ΤΕΛΟΣ",direction:0,shape:[],stops:["a","b","d"] },back:{headsign:"ΑΡΧΗ",direction:1,shape:[],stops:["d","c","a"]} } };
const vehicle = (values: Partial<Vehicle> = {}): Vehicle => ({id:"1",lat:38,lon:23,bearing:null,position_at:990,route_code:"",variant:"out",trip_id:null,trip_label:null,delay_s:null,next_stop_id:"a",...values});
const live = (...vehicles: Vehicle[]): LineLive => ({line:"040",updated_at:990,next_update_at:1020,vehicles});

describe("physical stop discovery", () => {
  it("keeps same-name opposite-direction stops separate with the correct destinations", () => {
    const stops = indexStops(ix);
    expect(stops[1].services.map(s => s.variant)).toEqual(["out"]);
    expect(stops[2].services.map(s => s.variant)).toEqual(["back"]);
    expect(stops[1].services[0].destination_en).toBe("End");
    expect(stops[3].services.find(s => s.variant === "out")?.boarding).toBe(false);
    expect(stops[3].services.find(s => s.variant === "back")?.boarding).toBe(true);
  });
  it("supports Greek and English search, radius filtering and distance order", () => {
    const stops = indexStops(ix);
    expect(findStops(stops,"",null)).toEqual([]);
    expect(findStops(stops,"σταση",null).map(r => r.stop.id)).toEqual([1,2]);
    expect(findStops(stops,"Stop",[38.001,23],10).map(r => r.stop.id)).toEqual([1]);
    expect(findStops(stops,"",[38,23],150).map(r => r.stop.id)).toEqual([0,1,2]);
  });
});

describe("reported next-stop counts", () => {
  const stop = indexStops(ix)[1], service = stop.services[0];
  it("counts only vehicles approaching in the correct direction with fresh GPS", () => {
    const result = approachingStop(stop,service,live(vehicle(),vehicle({id:"2",next_stop_id:"b"}),vehicle({id:"3",next_stop_id:"d"}),vehicle({id:"4",variant:"back",next_stop_id:"c"}),vehicle({id:"5",position_at:700})),st,1000);
    expect(result.map(v => [v.id,v.stopsAway])).toEqual([["2",1],["1",2]]);
  });
  it("refuses missing, future, mismatched and ambiguous loop measurements", () => {
    expect(approachingStop(stop,service,live(vehicle({position_at:1100}),vehicle({next_stop_id:null}),vehicle({position_at:NaN})),st,1000)).toEqual([]);
    expect(approachingStop(stop,service,live(vehicle()),{...st,id:"550"},1000)).toEqual([]);
    expect(approachingStop(stop,service,live(vehicle()),{...st,variants:{out:{...st.variants.out,stops:["a","b","d","b"]}}},1000)).toEqual([]);
    expect(approachingStop(stop,service,live(vehicle()),{...st,variants:{out:{...st.variants.out,stops:["a","a","b"]}}},1000)).toEqual([]);
  });
});
