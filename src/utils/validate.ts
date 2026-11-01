import type {
  CompetitiveEvent,
  CompetitiveEventType,
  Confidence,
  Region,
  TeamFormat,
  UpdateEvent,
  UpdateKind,
} from "../types/events";

/**
 * Runtime guards for data coming from JSON or an API. Invalid records are dropped (and logged) instead of
 * crashing the page, so one bad entry can't take the tracker down.
 */

const CONFIDENCE: readonly Confidence[] = ["official", "reported", "estimated"];
const UPDATE_KINDS: readonly UpdateKind[] = ["season-launch", "patch", "hotfix", "service-maintenance"];
const FORMATS: readonly TeamFormat[] = ["solo", "duos", "trios", "squads"];
const EVENT_TYPES: readonly CompetitiveEventType[] = [
  "cash-cup",
  "victory-cup",
  "fncs",
  "creator-cup",
  "ranked-cup",
  "tournament",
];
const REGIONS: readonly Region[] = ["EU", "ME", "NAC", "NAW", "BR", "ASIA", "OCE"];

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isOptString = (v: unknown) => v === undefined || isString(v);
const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);
/** Must be parseable and carry an explicit offset, so it can't be misread as the viewer's local time. */
const isIsoWithOffset = (v: unknown): v is string =>
  isString(v) && /([+-]\d{2}:\d{2}|Z)$/.test(v) && !Number.isNaN(Date.parse(v));
const isOptIso = (v: unknown) => v === undefined || isIsoWithOffset(v);

export function isUpdateEvent(v: unknown): v is UpdateEvent {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    isString(v.name) &&
    (v.version === null || isString(v.version)) &&
    isOneOf(UPDATE_KINDS, v.kind) &&
    isIsoWithOffset(v.downtimeStartsAt) &&
    isIsoWithOffset(v.expectedEndAt) &&
    Date.parse(v.expectedEndAt) > Date.parse(v.downtimeStartsAt) &&
    isOptIso(v.actualEndAt) &&
    isOptIso(v.matchmakingDisabledAt) &&
    isOneOf(CONFIDENCE, v.confidence) &&
    isOptString(v.notes) &&
    isOptString(v.sourceUrl)
  );
}

export function isCompetitiveEvent(v: unknown): v is CompetitiveEvent {
  if (!isRecord(v) || !isRecord(v.requirements)) return false;
  const r = v.requirements;
  return (
    isString(v.id) &&
    isString(v.name) &&
    isOneOf(EVENT_TYPES, v.type) &&
    isOneOf(REGIONS, v.region) &&
    isString(v.mode) &&
    isOneOf(FORMATS, v.format) &&
    isOptString(v.round) &&
    isIsoWithOffset(v.startsAt) &&
    isIsoWithOffset(v.endsAt) &&
    Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
    Array.isArray(r.regionEligibility) &&
    r.regionEligibility.every((x) => isOneOf(REGIONS, x)) &&
    isOptString(r.minRank) &&
    (r.minAccountLevel === undefined || (typeof r.minAccountLevel === "number" && r.minAccountLevel >= 0)) &&
    (r.twoFactorRequired === undefined || typeof r.twoFactorRequired === "boolean") &&
    isOneOf(CONFIDENCE, v.confidence) &&
    isOptString(v.prizePool) &&
    isOptString(v.notes) &&
    isOptString(v.sourceUrl)
  );
}

/** Keeps valid records, logs the rest, and de-duplicates by id (first wins). */
export function sanitizeList<T extends { id: string }>(
  input: unknown,
  guard: (v: unknown) => v is T,
  label: string,
): T[] {
  if (!Array.isArray(input)) {
    console.warn(`[tracker] ${label}: expected an array, got`, input);
    return [];
  }
  const seen = new Set<string>();
  const out: T[] = [];
  input.forEach((item, index) => {
    if (!guard(item)) {
      console.warn(`[tracker] ${label}: dropped invalid record at index ${index}`, item);
      return;
    }
    if (seen.has(item.id)) {
      console.warn(`[tracker] ${label}: dropped duplicate id "${item.id}"`);
      return;
    }
    seen.add(item.id);
    out.push(item);
  });
  return out;
}
