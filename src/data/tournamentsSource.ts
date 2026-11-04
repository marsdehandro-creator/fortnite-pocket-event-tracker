import type { CompetitiveEvent, SyncLog } from "../types/events";
import { isCompetitiveEvent, isSyncLog, sanitizeList } from "../utils/validate";

/**
 * Tournaments are served as static JSON from public/data/ (written by scripts/sync-tournaments.ts) and fetched
 * at runtime, so a calendar with hundreds of events doesn't bloat the app bundle and a data-only deploy is enough
 * to update the site.
 */

export interface TournamentData {
  events: CompetitiveEvent[];
  updatedAt: string | null;
  log: SyncLog | null;
}

const url = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

async function getJson(file: string, signal?: AbortSignal): Promise<unknown> {
  // no-cache: revalidate with the server so a fresh deploy shows up immediately (still uses ETags)
  const res = await fetch(url(file), { signal, cache: "no-cache", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

export async function loadTournaments(signal?: AbortSignal): Promise<TournamentData> {
  const [envelope, log] = await Promise.all([
    getJson("tournaments.json", signal) as Promise<{ updatedAt?: unknown; items?: unknown }>,
    // The log is informational; a missing or broken log must not hide the events.
    getJson("sync-log.json", signal).catch(() => null),
  ]);
  return {
    events: sanitizeList(envelope.items, isCompetitiveEvent, "tournaments"),
    updatedAt: typeof envelope.updatedAt === "string" ? envelope.updatedAt : null,
    log: isSyncLog(log) ? log : null,
  };
}
