import { describe, expect, it } from "vitest";
import { serializeSelection } from "../src/lib/selection";
import { translate } from "../src/lib/translate";

describe("UI languages", () => {
  it("keeps the language when adding, removing, or sharing lines", () => {
    expect(serializeSelection(["040", "550"], "en")).toBe("?l=040,550&lang=en");
    expect(serializeSelection([], "el")).toBe("");
    expect(serializeSelection(["040"], "unexpected")).toBe("?l=040");
  });
  it("keeps Greek text and non-string values unchanged", () => {
    expect(translate("Επόμενη στάση", "el")).toBe("Επόμενη στάση");
    expect(translate(40, "en")).toBe(40);
    expect(translate(null, "en")).toBeNull();
  });
  it("translates complete warnings and normalized multiline help", () => {
    expect(translate("Επόμενη στάση", "en")).toBe("Next stop");
    expect(translate("Το πρόγραμμα έχει λήξει. Η σύγκριση με το ωράριο είναι κατά προσέγγιση· η θέση GPS ενημερώνεται ξεχωριστά.", "en")).toBe("The timetable has expired. Schedule comparisons are approximate; GPS positions update separately.");
    expect(translate("  Και οι δύο\n κατευθύνσεις  ", "en")).toBe("  Both directions  ");
  });
  it("retains line and vehicle IDs in dynamic accessible labels", () => {
    expect(translate("Γραμμή 040, όχημα 40868", "en")).toBe("Line 040, vehicle 40868");
    expect(translate("Αφαίρεση γραμμής Χ95", "en")).toBe("Remove line Χ95");
  });
  it("uses natural English for GPS age and rounded schedule comparisons", () => {
    expect(translate("πριν 24 δευτερόλεπτα", "en")).toBe("24 seconds ago");
    expect(translate("Περίπου 2 λεπτά καθυστέρηση", "en")).toBe("About 2 minutes late");
  });
  it("preserves upstream stop names and route identifiers", () => {
    expect(translate("ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ", "en")).toBe("ΠΕΙΡΑΙΑΣ - ΣΥΝΤΑΓΜΑ");
    expect(translate("Χ95", "en")).toBe("Χ95");
    expect(translate("ΗΣΑΠ Ν.ΦΑΛΗΡΟΥ", "en")).toBe("ΗΣΑΠ Ν.ΦΑΛΗΡΟΥ");
  });
});
