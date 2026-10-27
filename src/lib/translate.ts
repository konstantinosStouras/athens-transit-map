import { english } from "./translations";
export type Language = "el" | "en";
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Longest phrases first keeps complete sentences intact, while allowing dynamic labels
// such as "Remove line 040" and durations to retain their values.
const phrases = Object.keys(english).sort((a, b) => b.length - a.length);
const pattern = new RegExp(`(?<![\\p{L}])(?:${phrases.map(escape).join("|")})(?![\\p{L}])`, "gu");
export function translate<T>(value: T, language: Language): T {
  if (language === "el" || typeof value !== "string" || !/[\u0370-\u03ff\u1f00-\u1fff]/.test(value)) return value;
  const key = normalize(value);
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  let result = english[key];
  if (result == null) {
    if (key.startsWith("πριν ")) result = `${translate(key.slice(5), "en")} ago`;
    else result = key.replace(pattern, phrase => english[phrase]);
  }
  return (leading + result + (key ? trailing : "")) as T;
}
