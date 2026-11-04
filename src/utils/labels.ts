import type { CompetitiveStatus, Confidence, TeamFormat, UpdateKind, UpdateStatus } from "../types/events";
import type { DiscoveryCategory, DiscoveryRarity, MapChangeType, PlayStyle } from "../types/intel";

export const UPDATE_STATUS_LABEL: Record<UpdateStatus, string> = {
  upcoming: "Upcoming",
  maintenance: "Maintenance",
  live: "Live",
  completed: "Completed",
};

export const EVENT_STATUS_LABEL: Record<CompetitiveStatus, string> = {
  upcoming: "Upcoming",
  active: "Live",
  finished: "Completed",
  cancelled: "Cancelled",
};

export const UPDATE_KIND_LABEL: Record<UpdateKind, string> = {
  "season-launch": "Season launch",
  patch: "Patch",
  hotfix: "Hotfix",
  "service-maintenance": "Service maintenance",
};

/** Nicer labels for some known type slugs. Not a whitelist: any other slug is humanised by eventTypeLabel(). */
const KNOWN_EVENT_TYPE_LABEL: Record<string, string> = {
  fncs: "FNCS",
  "cash-cup": "Cash Cup",
  "victory-cup": "Victory Cup",
  "ranked-cup": "Ranked Cup",
  "creator-cup": "Creator Cup",
  "skin-cup": "Skin Cup",
  lcq: "Last Chance Qualifier",
};

const ACRONYMS = new Set(["fncs", "zb", "lcq", "og", "pj", "eu", "na", "lan"]);

/** "performance-evaluation" → "Performance Evaluation"; known acronyms stay upper-case. */
export function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function eventTypeLabel(type: string): string {
  return KNOWN_EVENT_TYPE_LABEL[type] ?? humanizeSlug(type);
}

export const FORMAT_LABEL: Record<TeamFormat, string> = {
  solo: "Solo",
  duos: "Duos",
  trios: "Trios",
  squads: "Squads",
};

export const FORMATS: TeamFormat[] = ["solo", "duos", "trios", "squads"];

const REGION_NAMES: Record<string, string> = {
  EU: "Europe",
  ME: "Middle East",
  NAE: "NA East",
  NAC: "NA Central",
  NAW: "NA West",
  BR: "Brazil",
  ASIA: "Asia",
  OCE: "Oceania",
};

/** Full region name; unknown codes (a region Epic adds later) show as-is. */
export function regionLabel(code: string): string {
  return REGION_NAMES[code] ?? code;
}

/** Regions South African players normally queue on — highlighted in the UI. */
export const LOCAL_REGIONS: string[] = ["EU", "ME"];

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  official: "Official",
  reported: "Reported",
  estimated: "Estimated",
};

export const CONFIDENCE_HINT: Record<Confidence, string> = {
  official: "Announced by Epic Games",
  reported: "Reported by trusted sources, not yet confirmed by Epic",
  estimated: "Estimated from typical timings — may change",
};

// ---------------------------------------------------------------------------
// Map intel
// ---------------------------------------------------------------------------


export const DISCOVERY_CATEGORY_LABEL: Record<DiscoveryCategory, string> = {
  "secret-location": "Secret Location",
  "loot-route": "Loot Route",
  "easter-egg": "Easter Egg",
  "rotation-route": "Rotation Route",
  "hidden-chest-area": "Hidden Chest Area",
  "npc-spawn": "NPC Spawn",
  "vehicle-spawn": "Vehicle Spawn",
  "competitive-advantage": "Competitive Advantage",
};

export const DISCOVERY_RARITY_LABEL: Record<DiscoveryRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const PLAY_STYLE_LABEL: Record<PlayStyle, string> = {
  casual: "Casual",
  arena: "Arena",
  ranked: "Ranked",
  tournament: "Tournament",
};

export const MAP_CHANGE_LABEL: Record<MapChangeType, string> = {
  added: "New",
  removed: "Removed",
  buffed: "Buffed",
  nerfed: "Nerfed",
  reworked: "Reworked",
  "map-update": "Map update",
};
