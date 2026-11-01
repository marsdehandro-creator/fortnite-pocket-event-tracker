import type {
  DiscoveryCategory,
  DiscoveryRarity,
  MapChange,
  MapChangeType,
  MapDiscovery,
  PlayStyle,
  POIRanking,
  Season,
} from "../types/intel";
import {
  CONFIDENCE,
  FORMATS,
  isIsoWithOffset,
  isOneOf,
  isOptIso,
  isOptString,
  isRecord,
  isString,
} from "./validate";

export const DISCOVERY_CATEGORIES: readonly DiscoveryCategory[] = [
  "secret-location",
  "loot-route",
  "easter-egg",
  "rotation-route",
  "hidden-chest-area",
  "npc-spawn",
  "vehicle-spawn",
  "competitive-advantage",
];
export const DISCOVERY_RARITIES: readonly DiscoveryRarity[] = ["common", "rare", "epic", "legendary"];
export const PLAY_STYLES: readonly PlayStyle[] = ["casual", "arena", "ranked", "tournament"];
export const MAP_CHANGE_TYPES: readonly MapChangeType[] = ["added", "removed", "buffed", "nerfed", "reworked", "map-update"];

const isScore = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10;
const isListOf = <T extends string>(list: readonly T[], v: unknown) =>
  Array.isArray(v) && v.every((x) => isOneOf(list, x));

export function isSeason(v: unknown): v is Season {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    isString(v.name) &&
    isString(v.mapName) &&
    isIsoWithOffset(v.startsAt) &&
    isOptIso(v.endsAt) &&
    (v.endsAt === undefined || Date.parse(v.endsAt as string) > Date.parse(v.startsAt)) &&
    (v.endConfidence === undefined || isOneOf(CONFIDENCE, v.endConfidence)) &&
    (v.playerCount === undefined || (typeof v.playerCount === "number" && v.playerCount > 0)) &&
    isOptString(v.notes) &&
    isOptString(v.sourceUrl)
  );
}

export function isMapDiscovery(v: unknown): v is MapDiscovery {
  if (!isRecord(v)) return false;
  const archived = v.status === "archived";
  return (
    isString(v.id) &&
    isString(v.title) &&
    isString(v.summary) &&
    isOptString(v.details) &&
    isString(v.mapArea) &&
    isOptString(v.poiId) &&
    isOneOf(DISCOVERY_CATEGORIES, v.category) &&
    isOneOf(DISCOVERY_RARITIES, v.rarity) &&
    (v.lootRating === undefined || (Number.isInteger(v.lootRating) && (v.lootRating as number) >= 1 && (v.lootRating as number) <= 5)) &&
    isString(v.seasonId) &&
    isIsoWithOffset(v.addedAt) &&
    (v.featured === undefined || typeof v.featured === "boolean") &&
    (v.status === "active" || archived) &&
    // archived records must say when and why; active ones must not carry archive fields
    (archived ? isIsoWithOffset(v.archivedAt) && isString(v.archivedReason) : v.archivedAt === undefined && v.archivedReason === undefined) &&
    isOneOf(CONFIDENCE, v.confidence) &&
    isOptString(v.sourceUrl)
  );
}

export function isPOIRanking(v: unknown): v is POIRanking {
  if (!isRecord(v)) return false;
  const s = v.scores;
  const scoresOk =
    s === undefined ||
    (isRecord(s) && isScore(s.loot) && isScore(s.mobility) && isScore(s.materials) && isScore(s.contestRate) && isScore(s.competitive));
  return (
    isString(v.id) &&
    isString(v.name) &&
    isString(v.seasonId) &&
    isString(v.mapArea) &&
    isString(v.description) &&
    (v.status === "active" || v.status === "removed") &&
    scoresOk &&
    // a score without a reason is just a number — require the rationale
    (s === undefined || isString(v.rationale)) &&
    isOptString(v.rationale) &&
    (v.chestCount === undefined || (Number.isInteger(v.chestCount) && (v.chestCount as number) >= 0)) &&
    isListOf(FORMATS, v.recommendedTeamSizes) &&
    isListOf(PLAY_STYLES, v.bestFor) &&
    (v.highlights === undefined || (Array.isArray(v.highlights) && v.highlights.every(isString))) &&
    isOneOf(CONFIDENCE, v.confidence) &&
    isIsoWithOffset(v.updatedAt) &&
    isOptString(v.sourceUrl)
  );
}

export function isMapChange(v: unknown): v is MapChange {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    isIsoWithOffset(v.date) &&
    isString(v.seasonId) &&
    isOneOf(MAP_CHANGE_TYPES, v.type) &&
    isString(v.title) &&
    isString(v.description) &&
    isOptString(v.poiId) &&
    isOneOf(CONFIDENCE, v.confidence) &&
    isOptString(v.sourceUrl)
  );
}

export interface IntelSets {
  seasons: Season[];
  discoveries: MapDiscovery[];
  pois: POIRanking[];
  mapChanges: MapChange[];
}

/** Cross-file checks: every seasonId / poiId must point at a record that exists. Returns problems found. */
export function findBrokenReferences({ seasons, discoveries, pois, mapChanges }: IntelSets): string[] {
  const seasonIds = new Set(seasons.map((s) => s.id));
  const poiIds = new Set(pois.map((p) => p.id));
  const problems: string[] = [];
  const check = (kind: string, id: string, seasonId: string, poiId?: string) => {
    if (!seasonIds.has(seasonId)) problems.push(`${kind} "${id}" → unknown seasonId "${seasonId}"`);
    if (poiId && !poiIds.has(poiId)) problems.push(`${kind} "${id}" → unknown poiId "${poiId}"`);
  };
  discoveries.forEach((d) => check("discovery", d.id, d.seasonId, d.poiId));
  pois.forEach((p) => check("poi", p.id, p.seasonId));
  mapChanges.forEach((c) => check("map change", c.id, c.seasonId, c.poiId));
  return problems;
}
