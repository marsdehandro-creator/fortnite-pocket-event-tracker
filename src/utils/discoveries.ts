import type { DiscoveryCategory, DiscoveryRarity, MapDiscovery } from "../types/intel";
import { toDate, type DateInput } from "./time";

/** A discovery counts as "New" for this long after it was logged. */
export const NEW_DISCOVERY_MS = 7 * 86_400_000;

const RARITY_RANK: Record<DiscoveryRarity, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };

export function isNewDiscovery(d: MapDiscovery, now: DateInput): boolean {
  const age = toDate(now).getTime() - Date.parse(d.addedAt);
  return d.status === "active" && age >= 0 && age < NEW_DISCOVERY_MS;
}

/** Lower-cases and strips accents so "Loguetown" matches "loguétown" and vice versa. */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesQuery(d: MapDiscovery, query: string): boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalizeText([d.title, d.summary, d.details ?? "", d.mapArea].join(" "));
  return terms.every((t) => haystack.includes(t));
}

export interface DiscoveryFilter {
  query: string;
  category: DiscoveryCategory | "all";
  includeArchived: boolean;
}

/** Newest first, rarer first on the same day. */
export function sortDiscoveries(list: MapDiscovery[]): MapDiscovery[] {
  return [...list].sort(
    (a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt) || RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity],
  );
}

export function filterDiscoveries(list: MapDiscovery[], f: DiscoveryFilter): MapDiscovery[] {
  return sortDiscoveries(
    list.filter(
      (d) =>
        (f.includeArchived || d.status === "active") &&
        (f.category === "all" || d.category === f.category) &&
        matchesQuery(d, f.query),
    ),
  );
}

/** The newest active discovery flagged `featured`; falls back to the rarest, newest active one. */
export function pickFeatured(list: MapDiscovery[]): MapDiscovery | null {
  const active = list.filter((d) => d.status === "active");
  const flagged = sortDiscoveries(active.filter((d) => d.featured));
  if (flagged.length) return flagged[0];
  return [...active].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || Date.parse(b.addedAt) - Date.parse(a.addedAt))[0] ?? null;
}

export function countByCategory(list: MapDiscovery[]): Record<DiscoveryCategory | "all", number> {
  const counts = { all: list.length } as Record<DiscoveryCategory | "all", number>;
  list.forEach((d) => (counts[d.category] = (counts[d.category] ?? 0) + 1));
  return counts;
}
