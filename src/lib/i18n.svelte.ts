import { translate, type Language } from "./translate";
export const LANGUAGE_KEY = "oasa-language";
function initialLanguage(): Language {
  if (typeof window === "undefined") return "el";
  const query = new URLSearchParams(window.location.search).get("lang");
  if (query === "en" || query === "el") return query;
  try { return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "el"; } catch { return "el"; }
}
export const locale = $state({ language: initialLanguage() });
export function setLanguage(language: Language) {
  locale.language = language;
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* private browsing */ }
  const url = new URL(window.location.href);
  url.searchParams.set("lang", language);
  window.history.replaceState(window.history.state, "", url);
}
export function t<T>(value: T): T { return translate(value, locale.language); }
