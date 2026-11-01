import type { TeamFormat } from "../types/events";
import type { MapChange, POIRanking, POIScores } from "../types/intel";
import { toDate, type DateInput } from "./time";

/**
 * Overall score = weighted blend of the sub-scores. Contest rate is inverted (a quieter drop is safer).
 * Weights live here, not in the data, so every POI is scored on the same scale.
 */
export const SCORE_WEIGHTS = {
  loot: 0.3,
  competitive: 0.25,
  mobility: 0.2,
  materials: 0.15,
  survivability: 0.1, // = 10 - contestRate
} as const;

export function overallScore(s: POIScores): number {
  const raw =
    s.loot * SCORE_WEIGHTS.loot +
    s.competitive * SCORE_WEIGHTS.competitive +
    s.mobility * SCORE_WEIGHTS.mobility +
    s.materials * SCORE_WEIGHTS.materials +
    (10 - s.contestRate) * SCORE_WEIGHTS.survivability;
  return Math.round(raw * 10) / 10;
}

export type RatingStatus = "rated" | "provisional" | "unrated";

export function getRatingStatus(poi: POIRanking): RatingStatus {
  if (!poi.scores) return "unrated";
  return poi.confidence === "estimated" ? "provisional" : "rated";
}

export type POISort = "overall" | "loot" | "chests" | "contest" | "rotation" | "competitive";

export const POI_SORT_LABEL: Record<POISort, string> = {
  overall: "Overall score",
  loot: "Best loot",
  chests: "Most chests",
  contest: "Lowest contest rate",
  rotation: "Best rotation",
  competitive: "Best competitive POI",
};

export type POIFilter = "all" | TeamFormat | "competitive" | "casual";

export const POI_FILTER_LABEL: Record<POIFilter, string> = {
  all: "All",
  solo: "Solos",
  duos: "Duos",
  trios: "Trios",
  squads: "Squads",
  competitive: "Competitive",
  casual: "Casual",
};

export function matchesPOIFilter(poi: POIRanking, filter: POIFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "competitive":
      return poi.bestFor.some((p) => p === "arena" || p === "ranked" || p === "tournament");
    case "casual":
      return poi.bestFor.includes("casual");
    default:
      return poi.recommendedTeamSizes.includes(filter);
  }
}

/** Sort key per option; higher is better. Undefined values sink to the bottom. */
function sortValue(poi: POIRanking, sort: POISort): number | undefined {
  const s = poi.scores;
  switch (sort) {
    case "overall":
      return s && overallScore(s);
    case "loot":
      return s?.loot;
    case "chests":
      return poi.chestCount;
    case "contest":
      return s && 10 - s.contestRate;
    case "rotation":
      return s?.mobility;
    case "competitive":
      return s?.competitive;
  }
}

export interface RankedPOI {
  poi: POIRanking;
  /** 1-based position under the current sort; null when the POI has no value for it. */
  rank: number | null;
  overall: number | null;
  status: RatingStatus;
}

/** Active POIs that pass the filter, ordered by the chosen sort. Ties break on overall score, then name. */
export function rankPOIs(pois: POIRanking[], sort: POISort, filter: POIFilter = "all"): RankedPOI[] {
  const rows = pois
    .filter((p) => p.status === "active" && matchesPOIFilter(p, filter))
    .map((poi) => ({ poi, value: sortValue(poi, sort), overall: poi.scores ? overallScore(poi.scores) : null }));

  rows.sort((a, b) => {
    if (a.value === undefined && b.value === undefined) return a.poi.name.localeCompare(b.poi.name);
    if (a.value === undefined) return 1;
    if (b.value === undefined) return -1;
    return b.value - a.value || (b.overall ?? -1) - (a.overall ?? -1) || a.poi.name.localeCompare(b.poi.name);
  });

  let position = 0;
  return rows.map(({ poi, value, overall }) => ({
    poi,
    overall,
    status: getRatingStatus(poi),
    rank: value === undefined ? null : ++position,
  }));
}

/** Most recent change already in effect for a POI (scheduled future changes excluded). */
export function latestChangeFor(poiId: string, changes: MapChange[], now: DateInput): MapChange | null {
  const t = toDate(now).getTime();
  return (
    changes
      .filter((c) => c.poiId === poiId && Date.parse(c.date) <= t)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] ?? null
  );
}

/** Feed order: scheduled changes (soonest first), then past changes (newest first). */
export function orderMapChanges(changes: MapChange[], now: DateInput): { change: MapChange; scheduled: boolean }[] {
  const t = toDate(now).getTime();
  const rows = changes.map((change) => ({ change, scheduled: Date.parse(change.date) > t }));
  return rows.sort((a, b) => {
    if (a.scheduled !== b.scheduled) return a.scheduled ? -1 : 1;
    const diff = Date.parse(a.change.date) - Date.parse(b.change.date);
    return a.scheduled ? diff : -diff;
  });
}
