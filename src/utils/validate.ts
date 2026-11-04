import type { CompetitiveEvent, Confidence, SyncLog, SyncRun, TeamFormat, UpdateEvent, UpdateKind } from "../types/events";

/**
 * Runtime guards for data coming from JSON or an API. Invalid records are dropped (and logged) instead of
 * crashing the page, so one bad entry can't take the tracker down.
 */

export const CONFIDENCE: readonly Confidence[] = ["official", "reported", "estimated"];
const UPDATE_KINDS: readonly UpdateKind[] = ["season-launch", "patch", "hotfix", "service-maintenance"];
export const FORMATS: readonly TeamFormat[] = ["solo", "duos", "trios", "squads"];
/** Tournament types and regions are open-ended (Epic adds new ones); only their shape is checked. */
export const isTypeSlug = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
export const isRegionCode = (v: unknown): v is string => typeof v === "string" && /^[A-Z0-9]{2,8}$/.test(v);
const isStringList = (v: unknown) => v === undefined || (Array.isArray(v) && v.every(isString));

export type Rec = Record<string, unknown>;

export const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
export const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
export const isOptString = (v: unknown) => v === undefined || isString(v);
export const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);
/** Must be parseable and carry an explicit offset, so it can't be misread as the viewer's local time. */
export const isIsoWithOffset = (v: unknown): v is string =>
  isString(v) && /([+-]\d{2}:\d{2}|Z)$/.test(v) && !Number.isNaN(Date.parse(v));
export const isOptIso = (v: unknown) => v === undefined || isIsoWithOffset(v);

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
    isTypeSlug(v.type) &&
    isRegionCode(v.region) &&
    isString(v.mode) &&
    (v.format === undefined || isOneOf(FORMATS, v.format)) &&
    isOptString(v.round) &&
    isIsoWithOffset(v.startsAt) &&
    isIsoWithOffset(v.endsAt) &&
    Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
    Array.isArray(r.regionEligibility) &&
    r.regionEligibility.every(isRegionCode) &&
    isStringList(r.other) &&
    isOptString(r.minRank) &&
    (r.minAccountLevel === undefined || (typeof r.minAccountLevel === "number" && r.minAccountLevel >= 0)) &&
    (r.twoFactorRequired === undefined || typeof r.twoFactorRequired === "boolean") &&
    isOneOf(CONFIDENCE, v.confidence) &&
    isOptString(v.prizePool) &&
    isOptString(v.notes) &&
    isOptString(v.sourceUrl) &&
    isOptString(v.groupId) &&
    isOptString(v.sourceId) &&
    isOptString(v.epicType) &&
    isOptString(v.roundType) &&
    isOptString(v.description) &&
    isOptString(v.rulesUrl) &&
    isOptString(v.imageUrl) &&
    isOptString(v.cancelledReason) &&
    isStringList(v.tags) &&
    isStringList(v.platforms) &&
    (v.timeTbd === undefined || typeof v.timeTbd === "boolean") &&
    (v.cancelled === undefined || typeof v.cancelled === "boolean") &&
    (v.previousStartsAt === undefined || (Array.isArray(v.previousStartsAt) && v.previousStartsAt.every(isIsoWithOffset))) &&
    isOptIso(v.firstSeenAt) &&
    isOptIso(v.lastSeenAt)
  );
}

function isSyncRun(v: unknown): v is SyncRun {
  if (!isRecord(v)) return false;
  const counts = ["discovered", "added", "updated", "unchanged", "rescheduled", "cancelled", "restored", "rejected", "archived"] as const;
  return (
    isIsoWithOffset(v.startedAt) &&
    isIsoWithOffset(v.finishedAt) &&
    isOneOf(["success", "partial", "failed"] as const, v.status) &&
    isString(v.source) &&
    Array.isArray(v.regions) &&
    counts.every((k) => typeof v[k] === "number" && (v[k] as number) >= 0) &&
    Array.isArray(v.errors) &&
    Array.isArray(v.warnings)
  );
}

export function isSyncLog(v: unknown): v is SyncLog {
  return isRecord(v) && isOptIso(v.lastAttemptAt) && isOptIso(v.lastSuccessAt) && Array.isArray(v.runs) && v.runs.every(isSyncRun);
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
