import type {
  CompetitiveEvent,
  CompetitiveStatus,
  UpdateEvent,
  UpdateStatus,
} from "../types/events";
import { toDate, type DateInput } from "./time";

/** Visual tone used by status indicators: green = live, orange = scheduled, red = down. */
export type StatusTone = "green" | "orange" | "red" | "grey";

export const UPDATE_STATUS_TONE: Record<UpdateStatus, StatusTone> = {
  upcoming: "orange",
  maintenance: "red",
  live: "green",
  completed: "grey",
};

export const EVENT_STATUS_TONE: Record<CompetitiveStatus, StatusTone> = {
  upcoming: "orange",
  active: "green",
  finished: "grey",
  cancelled: "red",
};

const ms = (d: DateInput) => toDate(d).getTime();

/** When servers return: the confirmed end if known, otherwise the estimate. */
export function getUpdateEnd(update: UpdateEvent): Date {
  return toDate(update.actualEndAt ?? update.expectedEndAt);
}

/** Total downtime length (actual if known, otherwise expected). */
export function getUpdateDurationMs(update: UpdateEvent): number {
  return getUpdateEnd(update).getTime() - ms(update.downtimeStartsAt);
}

/** Id of the game update currently live: the most recent game update whose downtime has finished. */
export function getLiveUpdateId(updates: UpdateEvent[], now: DateInput): string | null {
  const t = ms(now);
  let latest: UpdateEvent | null = null;
  for (const u of updates) {
    if (u.kind === "service-maintenance") continue;
    if (getUpdateEnd(u).getTime() > t) continue;
    if (!latest || ms(u.downtimeStartsAt) > ms(latest.downtimeStartsAt)) latest = u;
  }
  return latest?.id ?? null;
}

export function getUpdateStatus(update: UpdateEvent, now: DateInput, liveUpdateId: string | null): UpdateStatus {
  const t = ms(now);
  if (t < ms(update.downtimeStartsAt)) return "upcoming";
  if (t < getUpdateEnd(update).getTime()) return "maintenance";
  return update.id === liveUpdateId ? "live" : "completed";
}

export interface UpdateWithStatus {
  update: UpdateEvent;
  status: UpdateStatus;
}

const UPDATE_ORDER: Record<UpdateStatus, number> = { maintenance: 0, upcoming: 1, live: 2, completed: 3 };

/** Statuses for all updates, ordered for display: down now → upcoming (soonest first) → live → past (newest first). */
export function rankUpdates(updates: UpdateEvent[], now: DateInput): UpdateWithStatus[] {
  const liveId = getLiveUpdateId(updates, now);
  return updates
    .map((update) => ({ update, status: getUpdateStatus(update, now, liveId) }))
    .sort((a, b) => {
      const byStatus = UPDATE_ORDER[a.status] - UPDATE_ORDER[b.status];
      if (byStatus) return byStatus;
      const diff = ms(a.update.downtimeStartsAt) - ms(b.update.downtimeStartsAt);
      return a.status === "upcoming" || a.status === "maintenance" ? diff : -diff;
    });
}

export function getEventStatus(event: CompetitiveEvent, now: DateInput): CompetitiveStatus {
  if (event.cancelled) return "cancelled";
  const t = ms(now);
  if (t < ms(event.startsAt)) return "upcoming";
  if (t < ms(event.endsAt)) return "active";
  return "finished";
}

export interface EventWithStatus {
  event: CompetitiveEvent;
  status: CompetitiveStatus;
}

const EVENT_ORDER: Record<CompetitiveStatus, number> = { active: 0, upcoming: 1, finished: 2, cancelled: 3 };

/** Active → upcoming (soonest first) → finished (most recent first) → cancelled. */
export function rankEvents(events: CompetitiveEvent[], now: DateInput): EventWithStatus[] {
  return events
    .map((event) => ({ event, status: getEventStatus(event, now) }))
    .sort((a, b) => {
      const byStatus = EVENT_ORDER[a.status] - EVENT_ORDER[b.status];
      if (byStatus) return byStatus;
      const diff = ms(a.event.startsAt) - ms(b.event.startsAt);
      return a.status === "finished" || a.status === "cancelled" ? -diff : diff;
    });
}

export type ScheduleLevel = "down" | "scheduled" | "clear";

export interface ScheduleStatus {
  level: ScheduleLevel;
  tone: StatusTone;
  label: string;
  /** The update driving the status, if any. */
  update?: UpdateEvent;
}

/** Look-ahead window in which an announced downtime turns the headline indicator orange. */
export const SCHEDULED_WINDOW_MS = 48 * 3_600_000;

/**
 * Headline indicator derived from the announced schedule (not a live server ping):
 * red while a downtime window is in progress, orange if one starts within 48h, otherwise green.
 */
export function getScheduleStatus(updates: UpdateEvent[], now: DateInput): ScheduleStatus {
  const t = ms(now);
  const active = updates.find((u) => t >= ms(u.downtimeStartsAt) && t < getUpdateEnd(u).getTime());
  if (active) return { level: "down", tone: "red", label: "Maintenance in progress", update: active };

  const next = updates
    .filter((u) => ms(u.downtimeStartsAt) > t && ms(u.downtimeStartsAt) - t <= SCHEDULED_WINDOW_MS)
    .sort((a, b) => ms(a.downtimeStartsAt) - ms(b.downtimeStartsAt))[0];
  if (next) return { level: "scheduled", tone: "orange", label: "Downtime scheduled", update: next };

  return { level: "clear", tone: "green", label: "No scheduled downtime" };
}

export type NextItem =
  | { kind: "update"; at: Date; inProgress: boolean; item: UpdateEvent }
  | { kind: "event"; at: Date; inProgress: boolean; item: CompetitiveEvent };

/**
 * The single most relevant thing to show in the hero: anything in progress first (downtime beats an event),
 * otherwise whichever update or event starts soonest.
 */
export function getNextItem(updates: UpdateEvent[], events: CompetitiveEvent[], now: DateInput): NextItem | null {
  const t = ms(now);
  events = events.filter((e) => !e.cancelled);
  const activeUpdate = updates.find((u) => t >= ms(u.downtimeStartsAt) && t < getUpdateEnd(u).getTime());
  if (activeUpdate) return { kind: "update", at: getUpdateEnd(activeUpdate), inProgress: true, item: activeUpdate };

  const activeEvent = events
    .filter((e) => t >= ms(e.startsAt) && t < ms(e.endsAt))
    .sort((a, b) => ms(a.endsAt) - ms(b.endsAt))[0];

  const candidates: NextItem[] = [
    ...updates
      .filter((u) => ms(u.downtimeStartsAt) > t)
      .map((u): NextItem => ({ kind: "update", at: toDate(u.downtimeStartsAt), inProgress: false, item: u })),
    ...events
      .filter((e) => ms(e.startsAt) > t)
      .map((e): NextItem => ({ kind: "event", at: toDate(e.startsAt), inProgress: false, item: e })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  if (activeEvent) return { kind: "event", at: toDate(activeEvent.endsAt), inProgress: true, item: activeEvent };
  return candidates[0] ?? null;
}
