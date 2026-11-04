/**
 * Merges a fresh capture of tournaments into the stored records. Guarantees:
 *  - no duplicates: records match on id, then Epic window id, then (for hand-entered legacy records) a fuzzy
 *    name + region + day key — a match updates the existing record instead of adding a new one;
 *  - reschedules are tracked (previous start times kept);
 *  - events that vanish from a region Epic returned successfully are marked cancelled, never deleted, and are
 *    restored if they reappear;
 *  - history is preserved: old events move to the archive instead of being removed.
 */

import type { CompetitiveEvent, SyncRun } from "../types/events";
import { sastDayKey } from "../utils/time";

export type MergeCounts = Pick<SyncRun, "discovered" | "added" | "updated" | "unchanged" | "rescheduled" | "cancelled" | "restored" | "archived">;

export interface MergeInput {
  current: CompetitiveEvent[];
  archive: CompetitiveEvent[];
  incoming: CompetitiveEvent[];
  /** Regions whose capture succeeded — only these can produce cancellations. */
  coveredRegions: string[];
  now: Date;
  /** Events that ended more than this many days ago move to the archive. */
  archiveAfterDays?: number;
}

export interface MergeResult {
  current: CompetitiveEvent[];
  archive: CompetitiveEvent[];
  counts: MergeCounts;
  warnings: string[];
}

const TRACKING_FIELDS = new Set(["firstSeenAt", "lastSeenAt"]);

/** Descriptive fields that only come from event pages, which a sync may skip for known tournaments. */
const KEEP_IF_MISSING = ["description", "rulesUrl", "imageUrl", "epicType", "prizePool", "notes"] as const satisfies readonly (keyof CompetitiveEvent)[];

/** Content equality ignoring bookkeeping fields. */
function sameContent(a: CompetitiveEvent, b: CompetitiveEvent): boolean {
  const strip = (e: CompetitiveEvent) =>
    JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !TRACKING_FIELDS.has(k)).sort(([x], [y]) => x.localeCompare(y))));
  return strip(a) === strip(b);
}

/** Loose identity for records without an Epic id: singularised name words + region + SAST day. */
export function fuzzyKey(e: Pick<CompetitiveEvent, "name" | "region" | "startsAt">): string {
  const words = e.name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
  return `${words.join(" ")}|${e.region}|${sastDayKey(e.startsAt)}`;
}

const byStart = (a: CompetitiveEvent, b: CompetitiveEvent) =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.region.localeCompare(b.region) || a.id.localeCompare(b.id);

export function mergeTournaments({ current, archive, incoming, coveredRegions, now, archiveAfterDays = 45 }: MergeInput): MergeResult {
  const nowIso = `${new Date(now.getTime() + 2 * 3_600_000).toISOString().slice(0, 19)}+02:00`;
  const counts: MergeCounts = { discovered: 0, added: 0, updated: 0, unchanged: 0, rescheduled: 0, cancelled: 0, restored: 0, archived: 0 };
  const warnings: string[] = [];

  // De-duplicate the capture itself (same window seen twice → keep the last).
  // Region pages overlap (e.g. NAC events also list on the NAE and NAW pages), so repeats are expected.
  const fresh = new Map<string, CompetitiveEvent>();
  let duplicates = 0;
  for (const e of incoming) {
    if (fresh.has(e.id)) duplicates++;
    fresh.set(e.id, e);
  }
  if (duplicates) warnings.push(`merged ${duplicates} duplicate sightings of the same event across region pages`);
  counts.discovered = fresh.size;

  const records = new Map<string, CompetitiveEvent>();
  const archived = new Map<string, CompetitiveEvent>(archive.map((e) => [e.id, e]));
  current.forEach((e) => records.set(e.id, e));

  const bySource = new Map<string, string>();
  const byFuzzy = new Map<string, string>();
  for (const e of [...records.values(), ...archived.values()]) {
    if (e.sourceId) bySource.set(e.sourceId, e.id);
    else byFuzzy.set(fuzzyKey(e), e.id);
  }

  const seen = new Set<string>();
  for (const inc of fresh.values()) {
    const matchId =
      (records.has(inc.id) || archived.has(inc.id) ? inc.id : undefined) ??
      (inc.sourceId ? bySource.get(inc.sourceId) : undefined) ??
      byFuzzy.get(fuzzyKey(inc));
    const existing = matchId ? (records.get(matchId) ?? archived.get(matchId)) : undefined;
    seen.add(inc.id);

    if (!existing || !matchId) {
      records.set(inc.id, { ...inc, firstSeenAt: nowIso, lastSeenAt: nowIso });
      counts.added++;
      continue;
    }

    const merged: CompetitiveEvent = { ...inc, firstSeenAt: existing.firstSeenAt ?? nowIso, lastSeenAt: nowIso };
    // A re-sync that skipped the event page shouldn't wipe details captured earlier.
    for (const key of KEEP_IF_MISSING) {
      if (merged[key] === undefined && existing[key] !== undefined) (merged as unknown as Record<string, unknown>)[key] = existing[key];
    }
    const sameWindow = !!existing.sourceId && existing.sourceId === inc.sourceId;
    const prior = existing.previousStartsAt ?? [];
    if (sameWindow && Date.parse(existing.startsAt) !== Date.parse(inc.startsAt)) {
      merged.previousStartsAt = [...prior, existing.startsAt];
      counts.rescheduled++;
    } else if (prior.length) {
      merged.previousStartsAt = prior;
    }
    if (existing.cancelled) counts.restored++;

    // A hand-entered record superseded by Epic's own record: replace it under the new id.
    if (matchId !== inc.id) {
      records.delete(matchId);
      archived.delete(matchId);
      warnings.push(`superseded ${matchId} with ${inc.id}`);
    }
    archived.delete(inc.id);
    records.set(inc.id, merged);
    if (sameContent({ ...existing, id: inc.id, previousStartsAt: existing.previousStartsAt }, merged)) counts.unchanged++;
    else counts.updated++;
  }

  // Cancellations: Epic-sourced, not yet ended, in a region we captured successfully, but missing now.
  const covered = new Set(coveredRegions);
  for (const [id, e] of records) {
    if (seen.has(id) || !e.sourceId || e.cancelled || !covered.has(e.region)) continue;
    if (Date.parse(e.endsAt) <= now.getTime()) continue; // finished events legitimately drop off Epic's schedule
    records.set(id, { ...e, cancelled: true, cancelledReason: "Removed from Epic's schedule" });
    counts.cancelled++;
  }

  // Archive (never delete) events that ended long ago.
  const cutoff = now.getTime() - archiveAfterDays * 86_400_000;
  for (const [id, e] of records) {
    if (Date.parse(e.endsAt) < cutoff) {
      archived.set(id, e);
      records.delete(id);
      counts.archived++;
    }
  }

  return {
    current: [...records.values()].sort(byStart),
    archive: [...archived.values()].sort(byStart),
    counts,
    warnings,
  };
}
