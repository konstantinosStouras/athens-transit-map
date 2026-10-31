import { expect, it } from "vitest";
import { stationName, searchStations } from "../src/lib/station-search";
import metro from "../public/metro.json";
const tram = metro.stations.filter(s => s.lines.some(l => l.startsWith("T")));

it("provides Latin labels for every tram station without changing Greek identity", () => {
  for (const s of tram) {
    expect(stationName(s, "en")).not.toMatch(/[\p{Script=Greek}]/u);
    expect(stationName(s, "el")).toBe(s.name);
  }
  expect(stationName({ name: "Σύνταγμα (Κέντρο)" }, "en")).toBe("Syntagma (Centre)");
  expect(stationName({ name: "Σύνταγμα", name_en: " Syntagma " }, "en")).toBe("Syntagma");
});
it.each(["Syntagma", "Σύνταγμα", "συνταγμα", "syntagma", "sintagma"])("finds the same station for %s", query => {
  expect(searchStations(tram, query).some(s => s.name === "Σύνταγμα (Κέντρο)")).toBe(true);
});
it.each(["Pikrodafni", "Πικροδάφνη", "pikrodafnh"])("finds Pikrodafni for %s", query => {
  expect(searchStations(tram, query).map(s => s.name)).toContain("Πικροδάφνη");
});
it.each(["Agia Paraskevi", "Αγία Παρασκευή", "agia paraskeyh"])("finds Agia Paraskevi for %s", query => {
  expect(searchStations(tram, query).map(s => s.name)).toContain("Αγία Παρασκευή");
});
it("matches partial names and returns original objects for timetable requests", () => {
  const station = { name: "Νέος Κόσμος", name_en: "Neos Kosmos" };
  expect(searchStations([station], "kosm")[0]).toBe(station);
  expect(searchStations([station], "unknown")).toEqual([]);
});
