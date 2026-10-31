import { expect, it } from "vitest";
import { searchTramServices } from "../src/lib/search";

it.each(["tram", "TRAM", " τραμ ", "ΤΡΆΜ", "tram schedules"])("finds tram schedules for %s", query => {
  expect(searchTramServices(query)).toEqual(["T6", "T7"]);
});
it.each(["T6", "t 6", "Τ6", "tram T6", "τραμ 6"])("finds a specific tram service for %s", query => {
  expect(searchTramServices(query)).toEqual(["T6"]);
});
it("keeps bus and unrelated searches out of tram results", () => {
  expect(searchTramServices("040")).toEqual([]);
  expect(searchTramServices("tramway street")).toEqual([]);
  expect(searchTramServices("T7")).toEqual(["T7"]);
});
