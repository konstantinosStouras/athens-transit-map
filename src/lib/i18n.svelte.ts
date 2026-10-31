import { displayName } from "./transit-names";
import { translate, type Language } from "./translate";
import { languageFromSearch, withLanguage } from "../../public/language-url.js";
export const LANGUAGE_KEY = "oasa-language";
function initialLanguage(): Language {
  if (typeof window === "undefined") return "el";
  if (!new URLSearchParams(window.location.search).has("lang")) {
    try { const saved = localStorage.getItem(LANGUAGE_KEY); if (saved === "en" || saved === "el") return saved; } catch { /* private browsing */ }
  }
  return languageFromSearch(window.location.search);
}
export const locale = $state({ language: initialLanguage() });
export function setLanguage(language: Language) {
  locale.language = language;
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* private browsing */ }
  const url = withLanguage(window.location.href, language);
  window.history.replaceState(window.history.state, "", url);
}
export function t<T>(value: T): T { return translate(value, locale.language); }

export function nameOf(value: import("./transit-names").TransitName | null | undefined): string { return displayName(value, locale.language); }
