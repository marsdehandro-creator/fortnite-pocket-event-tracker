import type { SyncLog, SyncRun } from "../types/events";

/** How many runs the log keeps (older entries are dropped from the log only — never from the data). */
export const MAX_LOG_RUNS = 60;

/** The sync is due when the last *successful* run is at least this old. A small tolerance absorbs scheduler jitter. */
export const SYNC_INTERVAL_HOURS = 72;
export const SYNC_TOLERANCE_HOURS = 2;

export function appendRun(log: SyncLog, run: SyncRun): SyncLog {
  return {
    lastAttemptAt: run.finishedAt,
    lastSuccessAt: run.status === "success" ? run.finishedAt : log.lastSuccessAt,
    runs: [run, ...log.runs].slice(0, MAX_LOG_RUNS),
  };
}

export interface DueCheck {
  due: boolean;
  reason: string;
  hoursSinceSuccess: number | null;
}

/** Due if there has never been a successful sync, or the last one was ≥ 72h ago (minus tolerance). */
export function isSyncDue(log: SyncLog, now: Date, intervalHours = SYNC_INTERVAL_HOURS): DueCheck {
  if (!log.lastSuccessAt) return { due: true, reason: "no successful sync recorded yet", hoursSinceSuccess: null };
  const hours = (now.getTime() - Date.parse(log.lastSuccessAt)) / 3_600_000;
  const due = hours >= intervalHours - SYNC_TOLERANCE_HOURS;
  return {
    due,
    reason: due
      ? `last successful sync was ${hours.toFixed(1)}h ago (≥ ${intervalHours}h)`
      : `last successful sync was ${hours.toFixed(1)}h ago; next due in ${(intervalHours - SYNC_TOLERANCE_HOURS - hours).toFixed(1)}h`,
    hoursSinceSuccess: hours,
  };
}

export const emptyCounts = () => ({
  discovered: 0,
  added: 0,
  updated: 0,
  unchanged: 0,
  rescheduled: 0,
  cancelled: 0,
  restored: 0,
  rejected: 0,
  archived: 0,
});
