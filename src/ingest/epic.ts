/**
 * Converts Epic's tournament data (as captured from fortnite.com/competitive by the browser extractors in
 * scripts/browser/) into site records. Nothing here filters by tournament type: every window Epic publishes
 * becomes an event, and its type comes from Epic's own classification (or the event name when Epic gives none).
 */

import type { CompetitiveEvent, TeamFormat } from "../types/events";
import { isCompetitiveEvent } from "../utils/validate";

/** One event window (a session in one region) from Epic's schedule page. */
export interface RawEpicWindow {
  windowId: string;
  groupId: string;
  tournamentName: string;
  roundName?: string;
  /** Epic's own state: "upcoming" | "live" | "ended" (kept for diagnostics; status is derived from times). */
  state?: string;
  beginTime: string;
  endTime: string;
  isTBD?: boolean;
  /** Epic's additionalRequirements tokens; nested arrays mean "any of". */
  requirements?: (string | string[])[];
  roundType?: string;
  platforms?: string[];
  region: string;
}

/** Tournament-level details from an Epic event page (one per event group). */
export interface RawEpicGroup {
  groupId: string;
  eventName?: string;
  /** e.g. "Battle Royale", "Zero Build". */
  mode?: string;
  tournamentType?: string;
  description?: string;
  minimumAccountLevel?: number;
  playlistId?: string;
  systemFeatures?: string[];
  rulesHref?: string;
  image?: string;
  isLan?: boolean;
}

export interface RawRegionCapture {
  ok: boolean;
  error?: string;
  windows: RawEpicWindow[];
}

/** The file the extractors produce and the sync CLI consumes. */
export interface RawSyncInput {
  capturedAt: string;
  source: string;
  regions: Record<string, RawRegionCapture>;
  groups: Record<string, RawEpicGroup>;
}

const SITE = "https://www.fortnite.com";
const ACRONYMS = new Set(["FNCS", "ZB", "LCQ", "OG", "PJ", "LAN", "NA", "EU", "ME", "BR", "OCE"]);
const MODE_SUFFIX = /\s+(Battle Royale|Zero Build|Ranked)$/i;

/** Tidy an event name: unify dashes and spaces, drop a trailing region tag, fix ALL-CAPS names. */
export function normalizeEventName(raw: string): string {
  let s = raw.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  s = s.replace(/\s*[-(]\s*(EU|ME|NAE|NAW|NAC|BR|ASIA|OCE)\)?$/i, "").trim();
  if (s.length > 4 && !/[a-z]/.test(s)) {
    s = s
      .split(" ")
      .map((w) => (ACRONYMS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
      .join(" ");
  }
  return s;
}

/** "CashCup" / "Cash Cup" / "cash_cup" → "cash-cup". */
export function toTypeSlug(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const FORMAT_WORDS: [RegExp, TeamFormat][] = [
  [/\bsolos?\b/i, "solo"],
  [/\bduos?\b/i, "duos"],
  [/\btrios?\b/i, "trios"],
  [/\bsquads?\b/i, "squads"],
];

/** Team size from the playlist id (most reliable) or the event name. Undefined when unknown. */
export function detectFormat(...hints: (string | undefined)[]): TeamFormat | undefined {
  for (const hint of hints) {
    if (!hint) continue;
    const words = hint.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
    const hit = FORMAT_WORDS.find(([re]) => re.test(words));
    if (hit) return hit[1];
  }
  return undefined;
}

/**
 * Type slug: Epic's own tournamentType when it has one; otherwise derived from the name by removing team-size,
 * mode and filler words (e.g. "Fortnite Performance Evaluation" → "performance-evaluation"). Never fails.
 */
/** Epic's catch-all values carry no information — derive the type from the name instead. */
const GENERIC_EPIC_TYPES = /^(other|none|unknown|default|generic)$/i;

export function deriveType(name: string, tournamentType?: string): string {
  if (tournamentType && !GENERIC_EPIC_TYPES.test(tournamentType.trim())) {
    const slug = toTypeSlug(tournamentType);
    if (slug) return slug;
  }
  if (/\bFNCS\b/i.test(name)) return "fncs";
  const stripped = name
    .replace(/\b(fortnite|solos?|duos?|trios?|squads?|reload|zb|zero build|battle royale)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return toTypeSlug(stripped || name) || "tournament";
}

function detectMode(window: RawEpicWindow, group?: RawEpicGroup): string {
  const fromName = window.tournamentName.match(MODE_SUFFIX)?.[1];
  let mode = group?.mode?.trim() || fromName || "Battle Royale";
  if (/\bZB\b|zero build/i.test(window.tournamentName) && !/zero build/i.test(mode)) mode = "Zero Build";
  if (/reload/i.test(window.tournamentName) && !/reload/i.test(mode)) mode = `${mode} · Reload`;
  return mode;
}

/** Epic's additionalRequirements tokens → plain-language requirements. Unknown tokens are skipped, not guessed. */
export function parseRequirements(tokens: (string | string[])[] = [], group?: RawEpicGroup) {
  const flat = tokens.flat();
  const other: string[] = [];
  if (flat.some((t) => t.startsWith("currentRanking:"))) other.push("Ranked rank requirement — see the event description");
  if (flat.some((t) => t.startsWith("eula:"))) other.push("Accept the event rules in-game");
  const features = group?.systemFeatures ?? [];
  const pc = ["SecureBoot", "CryptoProcessor", "IOMMU"].filter((f) => features.includes(f));
  if (pc.length) other.push("PC: Secure Boot, TPM and IOMMU enabled");
  return {
    twoFactorRequired: flat.includes("mfa") || undefined,
    minAccountLevel: group?.minimumAccountLevel,
    other: other.length ? other : undefined,
  };
}

/** Epic window id → stable site id, e.g. "S43_TriosCashCup_Event1_EU" → "epic-s43-trioscashcup-event1-eu". */
export const epicEventId = (windowId: string) => `epic-${windowId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** Converts a UTC ISO time to the same instant written in SAST (+02:00). */
export function toSastIso(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return `${new Date(t + 2 * 3_600_000).toISOString().slice(0, 19)}+02:00`;
}

export type NormalizeResult = { ok: true; event: CompetitiveEvent } | { ok: false; error: string };

export function normalizeEpicWindow(w: RawEpicWindow, group: RawEpicGroup | undefined): NormalizeResult {
  if (!w?.windowId || !w.groupId || !w.tournamentName) return { ok: false, error: `missing ids or name: ${JSON.stringify(w).slice(0, 120)}` };
  const startsAt = toSastIso(w.beginTime);
  const endsAt = toSastIso(w.endTime);
  if (!startsAt || !endsAt) return { ok: false, error: `${w.windowId}: unparseable time (${w.beginTime} – ${w.endTime})` };
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: `${w.windowId}: ends before it starts` };

  const region = (w.region || "").toUpperCase();
  const name = normalizeEventName(group?.eventName || w.tournamentName.replace(MODE_SUFFIX, ""));
  const req = parseRequirements(w.requirements, group);
  const tags = [...new Set([w.roundType, group?.isLan ? "LAN" : undefined, w.isTBD ? "Time TBD" : undefined].filter((t): t is string => !!t))];

  const event: CompetitiveEvent = {
    id: epicEventId(w.windowId),
    name,
    type: deriveType(name, group?.tournamentType),
    region,
    mode: detectMode(w, group),
    format: detectFormat(group?.playlistId, w.tournamentName, name),
    round: w.roundName?.trim() || undefined,
    startsAt,
    endsAt,
    requirements: {
      regionEligibility: [region],
      twoFactorRequired: req.twoFactorRequired,
      minAccountLevel: req.minAccountLevel,
      other: req.other,
    },
    confidence: "official",
    sourceUrl: `${SITE}/competitive/events/${encodeURIComponent(w.groupId)}?round=${encodeURIComponent(w.windowId)}&region=${region}`,
    groupId: w.groupId,
    sourceId: w.windowId,
    epicType: group?.tournamentType,
    roundType: w.roundType,
    description: group?.description?.trim() || undefined,
    rulesUrl: group?.rulesHref ? new URL(group.rulesHref, SITE).toString() : undefined,
    tags: tags.length ? tags : undefined,
    platforms: w.platforms?.length ? w.platforms : undefined,
    imageUrl: group?.image,
    timeTbd: w.isTBD || undefined,
  };
  // drop undefined keys so stored JSON stays tidy and comparisons are stable
  const clean = JSON.parse(JSON.stringify(event)) as CompetitiveEvent;
  return isCompetitiveEvent(clean) ? { ok: true, event: clean } : { ok: false, error: `${w.windowId}: failed validation after normalising` };
}
