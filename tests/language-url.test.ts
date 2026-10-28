import { describe, expect, it } from "vitest";
import { languageFromSearch, languageQuery, withLanguage } from "../public/language-url.js";
import { serializeSelection } from "../src/lib/selection";

describe("canonical language URLs", () => {
  it("uses Greek on a clean URL and accepts old Greek bookmarks", () => {
    expect(languageFromSearch("")).toBe("el");
    expect(languageFromSearch("?lang=el&l=040")).toBe("el");
    expect(languageFromSearch("?lang=en")).toBe("en");
    expect(languageFromSearch("?lang=unsupported")).toBe("el");
  });
  it("removes only the Greek language parameter, preserving route, account and anchor", () => {
    const url = withLanguage("https://www.stouras.com/athens-transit-map/?l=040&lang=en&account=1#stop", "el");
    expect(url.searchParams.get("l")).toBe("040");
    expect(url.searchParams.get("account")).toBe("1");
    expect(url.hash).toBe("#stop");
    expect(url.searchParams.has("lang")).toBe(false);
    expect(withLanguage(url, "en").searchParams.get("lang")).toBe("en");
  });
  it("keeps all new Greek page and shared-line links clean", () => {
    expect(languageQuery("el")).toBe("");
    expect(languageQuery("en")).toBe("?lang=en");
    expect(serializeSelection([], "el")).toBe("");
    expect(serializeSelection(["040"], "el")).toBe("?l=040");
    expect(serializeSelection(["040"], "en")).toBe("?l=040&lang=en");
  });
});
