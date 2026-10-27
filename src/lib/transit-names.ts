import type { Language } from "./translate";
export interface TransitName { name?: string | null; name_en?: string | null }
// Only use names supplied by the feed. Blank/missing English names keep the original.
export function displayName(value: TransitName | null | undefined, language: Language): string {
  return displayText(value?.name ?? "", value?.name_en, language);
}
export function displayText(original: string, english: string | null | undefined, language: Language): string {
  return language === "en" && english?.trim() ? english.trim() : original;
}

export function displayStop(stop: readonly [string, number, number, string?] | undefined, language: Language): string {
  return stop ? displayText(stop[0], stop[3], language) : "";
}
