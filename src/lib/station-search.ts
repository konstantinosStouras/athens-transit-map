import type { TransitName } from "./transit-names";
import type { Language } from "./translate";

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ");
const letters: Record<string, string> = { α:"a", β:"v", γ:"g", δ:"d", ε:"e", ζ:"z", η:"i", θ:"th", ι:"i", κ:"k", λ:"l", μ:"m", ν:"n", ξ:"x", ο:"o", π:"p", ρ:"r", σ:"s", τ:"t", υ:"y", φ:"f", χ:"ch", ψ:"ps", ω:"o" };
// Readable Latin names when the source omits its English field. Keep source IDs intact.
export function latinStationName(name: string): string {
  const original = plain(name);
  const known: Record<string, string> = {
    "συνταγμα (κεντρο)": "Syntagma (Centre)", "ν.κοσμοσ": "Neos Kosmos",
    "συγγρου-φιξ": "Syngrou-Fix", "δημοτικο θεατρο": "Dimotiko Theatro",
    "κεντρο ιστιοπλοιασ": "Sailing Centre", "κολυμβητηριο (γλυφαδα)": "Swimming Pool (Glyfada)",
  };
  if (known[original]) return known[original];
  if (!/[α-ω]/.test(original)) return name;
  return original.replace(/ου/g, "ou").replace(/αι/g, "ai").replace(/ει/g, "ei").replace(/οι/g, "oi")
    .replace(/ευ/g, "ev").replace(/αυ/g, "av").replace(/γγ/g, "ng").replace(/γκ/g, "g").replace(/μπ/g, "b")
    .replace(/[α-ω]/g, c => letters[c] ?? c)
    .replace(/(^|[\s(\-])([a-z])/g, (_, boundary, letter) => boundary + letter.toUpperCase());
}
export function stationName(station: TransitName, language: Language): string {
  return language === "en" ? station.name_en?.trim() || latinStationName(station.name ?? "") : station.name ?? "";
}
// Match common phonetic and keyboard Greeklish spellings, accents and punctuation.
function key(text: string): string {
  return plain(latinStationName(text)).replace(/[89]/g, "th").replace(/ey/g, "ev").replace(/ay/g, "av")
    .replace(/ch|kh|ks|x/g, "k").replace(/ng/g, "g").replace(/mp/g, "b")
    .replace(/ou/g, "u").replace(/ai/g, "e").replace(/ei|oi|y|h/g, "i")
    .replace(/w/g, "o").replace(/(.)\1/g, "$1")
    .replace(/[^a-z0-9]/g, "");
}
export function searchStations<T extends TransitName>(stations: T[], query: string): T[] {
  const q = key(query);
  return q ? stations.filter(s => [s.name ?? "", s.name_en ?? "", stationName(s, "en")].some(n => key(n).includes(q))) : stations;
}
