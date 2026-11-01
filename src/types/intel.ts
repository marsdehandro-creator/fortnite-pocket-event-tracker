/**
 * Map intelligence contracts: seasons, discoveries, POI rankings and map changes.
 * Like events.ts, these are the shapes the JSON in src/data/ (and any future API) must follow.
 * Anything derivable — overall score, rank, "new" badge, rating status — is computed in utils/, never stored.
 */

import type { Confidence, IsoDateString, TeamFormat } from "./events";

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export interface Season {
  /** Referenced by discoveries, POIs and map changes, e.g. "c7-treasure-hunters". */
  id: string;
  name: string;
  /** Short descriptor under the name, e.g. "Chapter 7 mini-season". */
  tagline?: string;
  /** Battle Royale island name. */
  mapName: string;
  startsAt: IsoDateString;
  /** Omit until announced. */
  endsAt?: IsoDateString;
  endConfidence?: Confidence;
  playerCount?: number;
  notes?: string;
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Map discoveries
// ---------------------------------------------------------------------------

export type DiscoveryCategory =
  | "secret-location"
  | "loot-route"
  | "easter-egg"
  | "rotation-route"
  | "hidden-chest-area"
  | "npc-spawn"
  | "vehicle-spawn"
  | "competitive-advantage";

/** Editorial "how notable is this" tier — drives the rarity indicator. */
export type DiscoveryRarity = "common" | "rare" | "epic" | "legendary";

export type DiscoveryStatus = "active" | "archived";

export interface MapDiscovery {
  id: string;
  title: string;
  /** One or two sentences shown on the collapsed card. */
  summary: string;
  /** Longer how-to / context shown when expanded. */
  details?: string;
  /** Human-readable area, e.g. "The $.$. Rocky, east coast". */
  mapArea: string;
  /** Optional artwork (path under public/ or absolute URL). Generated art is used when omitted. */
  imageUrl?: string;
  /** Links the discovery to a POI in pois.json when it sits in one. */
  poiId?: string;
  category: DiscoveryCategory;
  rarity: DiscoveryRarity;
  /** 1–5. Omit when the reward isn't known yet (shown as "Unrated"). */
  lootRating?: number;
  seasonId: string;
  addedAt: IsoDateString;
  /** Pin to the featured slot. The newest featured active discovery wins. */
  featured?: boolean;
  status: DiscoveryStatus;
  /** Required when archived: when and why (e.g. removed by a map update). */
  archivedAt?: IsoDateString;
  archivedReason?: string;
  confidence: Confidence;
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// POI rankings
// ---------------------------------------------------------------------------

export type PlayStyle = "casual" | "arena" | "ranked" | "tournament";

/** All scores are 0–10. */
export interface POIScores {
  loot: number;
  mobility: number;
  materials: number;
  /** How heavily contested the drop is — higher means more players land here. */
  contestRate: number;
  competitive: number;
}

export interface POIRanking {
  id: string;
  name: string;
  seasonId: string;
  /** Optional thumbnail (path under public/ or absolute URL). A generated map tile is used when omitted. */
  imageUrl?: string;
  /** Where on the island, e.g. "North-west". */
  mapArea: string;
  description: string;
  /** "removed" POIs drop out of the rankings but stay referenceable by map changes. */
  status: "active" | "removed";
  /** Omit until there's enough evidence to score — the card shows "Awaiting rating". */
  scores?: POIScores;
  /** Why the scores are what they are. Required whenever scores are present. */
  rationale?: string;
  chestCount?: number;
  recommendedTeamSizes: TeamFormat[];
  bestFor: PlayStyle[];
  highlights?: string[];
  /** "estimated" scores are shown as Provisional. */
  confidence: Confidence;
  updatedAt: IsoDateString;
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Map changes
// ---------------------------------------------------------------------------

export type MapChangeType = "added" | "removed" | "buffed" | "nerfed" | "reworked" | "map-update";

export interface MapChange {
  id: string;
  /** When the change lands. Future dates render as "Scheduled". */
  date: IsoDateString;
  seasonId: string;
  type: MapChangeType;
  title: string;
  description: string;
  /** The POI it affects, if any — its card then shows the latest change badge. */
  poiId?: string;
  confidence: Confidence;
  sourceUrl?: string;
}
