import type { CompetitiveEvent, TeamFormat, UpdateEvent } from "../types/events";
import { FORMATS, LOCAL_REGIONS } from "../utils/labels";
import { formatSASTDateTime, formatSASTShortDate, formatSASTTime } from "../utils/time";
import { classifyTournament, TOURNAMENT_CATEGORIES, type TournamentCategory } from "../utils/tournaments";

/**
 * Alert planning — pure functions shared by the page (while it's open) and the service worker (background checks).
 * Each tournament session and each scheduled update gets exactly two alerts: 2 days and 2 hours before it starts.
 */

export type AlertLead = "2d" | "2h";
export const LEAD_MS: Record<AlertLead, number> = { "2d": 48 * 3_600_000, "2h": 2 * 3_600_000 };
const LEADS: AlertLead[] = ["2d", "2h"];

export interface AlertPrefs {
  /** Master switch — nothing is shown until the viewer turns alerts on (and grants permission). */
  enabled: boolean;
  tournaments: boolean;
  updates: boolean;
  /** Filter buckets to alert on. */
  categories: TournamentCategory[];
  /** Region codes to alert on; empty = every region. */
  regions: string[];
  /** Team formats to alert on; empty = every format. Events without a known format always match. */
  formats: TeamFormat[];
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  enabled: false,
  tournaments: true,
  updates: true,
  // "Other" (mostly daily Ranked Cups) is off by default so alerts stay meaningful; one tap turns it on.
  categories: TOURNAMENT_CATEGORIES.filter((c) => c !== "other"),
  regions: [...LOCAL_REGIONS],
  formats: [],
};

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function isAlertPrefs(v: unknown): v is AlertPrefs {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.enabled === "boolean" &&
    typeof p.tournaments === "boolean" &&
    typeof p.updates === "boolean" &&
    isStringArray(p.categories) &&
    p.categories.every((c) => (TOURNAMENT_CATEGORIES as string[]).includes(c)) &&
    isStringArray(p.regions) &&
    isStringArray(p.formats) &&
    p.formats.every((f) => (FORMATS as string[]).includes(f))
  );
}

/** Does this tournament session match the viewer's alert filters? */
export function matchesAlertFilters(e: CompetitiveEvent, prefs: AlertPrefs): boolean {
  if (!prefs.categories.includes(classifyTournament(e))) return false;
  if (prefs.regions.length && !prefs.regions.includes(e.region)) return false;
  if (prefs.formats.length && e.format && !prefs.formats.includes(e.format)) return false;
  return true;
}

/** Upcoming sessions the viewer would be alerted about (cancelled and time-TBD sessions never alert). */
export function alertableEvents(events: CompetitiveEvent[], prefs: AlertPrefs, now: number): CompetitiveEvent[] {
  if (!prefs.tournaments) return [];
  return events.filter((e) => !e.cancelled && !e.timeTbd && Date.parse(e.startsAt) > now && matchesAlertFilters(e, prefs));
}

export function alertableUpdates(updates: UpdateEvent[], prefs: AlertPrefs, now: number): UpdateEvent[] {
  if (!prefs.updates) return [];
  return updates.filter((u) => Date.parse(u.downtimeStartsAt) > now);
}

export interface DueAlert {
  key: string;
  source: "tournament" | "update";
  lead: AlertLead;
  id: string;
  title: string;
  detail: string;
  startsAt: number;
}

/**
 * The 2-day alert is due from 48h before the start until the 2-hour alert takes over; the 2-hour alert is due
 * from 2h before until the start. Anything already sent (by key) is skipped, so the page and the service worker
 * can both check without double-alerting.
 */
function dueLead(start: number, now: number): AlertLead | null {
  if (now >= start) return null;
  if (now >= start - LEAD_MS["2h"]) return "2h";
  if (now >= start - LEAD_MS["2d"]) return "2d";
  return null;
}

export function planDueAlerts(input: {
  events: CompetitiveEvent[];
  updates: UpdateEvent[];
  prefs: AlertPrefs;
  now: number;
  sent: Record<string, number>;
}): DueAlert[] {
  const { prefs, now, sent } = input;
  if (!prefs.enabled) return [];
  const due: DueAlert[] = [];
  for (const e of alertableEvents(input.events, prefs, now)) {
    const start = Date.parse(e.startsAt);
    const lead = dueLead(start, now);
    const key = `t:${e.id}:${lead}`;
    if (lead && !sent[key]) {
      due.push({ key, source: "tournament", lead, id: e.id, title: e.name, detail: [e.round, e.region].filter(Boolean).join(" · "), startsAt: start });
    }
  }
  for (const u of alertableUpdates(input.updates, prefs, now)) {
    const start = Date.parse(u.downtimeStartsAt);
    const lead = dueLead(start, now);
    const key = `u:${u.id}:${lead}`;
    if (lead && !sent[key]) {
      due.push({ key, source: "update", lead, id: u.id, title: u.version ? `v${u.version} · ${u.name}` : u.name, detail: "Servers go down for maintenance", startsAt: start });
    }
  }
  return due.sort((a, b) => a.startsAt - b.startsAt);
}

/** "in 1h 45m" close to the start, otherwise "on Sat 7 Nov · 13:00 SAST". */
export function startsPhrase(start: number, now: number): string {
  const mins = Math.max(1, Math.round((start - now) / 60_000));
  if (mins < 60) return `in ${mins} min`;
  if (mins <= 3 * 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `in ${h}h${m ? ` ${m}m` : ""}`;
  }
  return `on ${formatSASTDateTime(start)}`;
}

export interface AlertNotification {
  tag: string;
  title: string;
  body: string;
  /** Page-relative link opened on click. */
  url: string;
  keys: string[];
}

const MAX_LISTED = 4;

/** One notification per (source, lead) batch, so a busy evening becomes one alert instead of ten. */
export function toNotifications(alerts: DueAlert[], now: number): AlertNotification[] {
  const groups = new Map<string, DueAlert[]>();
  for (const a of alerts) {
    const k = `${a.source}:${a.lead}`;
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  return [...groups.values()].map((items) => {
    const first = items[0];
    const isTournament = first.source === "tournament";
    const param = isTournament ? "event" : "update";
    const anchor = isTournament ? "events" : "updates";
    if (items.length === 1) {
      const verb = isTournament ? "starts" : "downtime starts";
      return {
        tag: first.key,
        title: `${first.title} ${verb} ${startsPhrase(first.startsAt, now)}`,
        body: `${first.detail} · ${formatSASTDateTime(first.startsAt)}`,
        url: `./?${param}=${encodeURIComponent(first.id)}#${anchor}`,
        keys: [first.key],
      };
    }
    const noun = isTournament ? "tournament sessions" : "scheduled updates";
    const window = first.lead === "2h" ? "in the next 2 hours" : "in the next 2 days";
    const when = (t: number) => (first.lead === "2h" ? formatSASTTime(t) : `${formatSASTShortDate(t)} ${formatSASTTime(t)}`);
    const lines = items.slice(0, MAX_LISTED).map((a) => `${when(a.startsAt)} ${a.title}${a.detail ? ` (${a.detail})` : ""}`);
    if (items.length > MAX_LISTED) lines.push(`+${items.length - MAX_LISTED} more`);
    return {
      tag: `${first.source}:${first.lead}:${items.map((a) => a.id).join(",")}`.slice(0, 200),
      title: `${items.length} ${noun} start ${window}`,
      body: lines.join("\n"),
      url: `./#${anchor}`,
      keys: items.map((a) => a.key),
    };
  });
}

/** Forget sent-alert keys once their event is long past, so storage never grows without bound. */
export function pruneSent(sent: Record<string, number>, now: number, keepMs = 4 * 86_400_000): Record<string, number> {
  return Object.fromEntries(Object.entries(sent).filter(([, at]) => now - at < keepMs));
}

/** The next scheduled alert time (strictly in the future) this viewer will get, for the settings preview. */
export function nextAlert(
  events: CompetitiveEvent[],
  updates: UpdateEvent[],
  prefs: AlertPrefs,
  now: number,
): { at: number; lead: AlertLead; title: string } | null {
  const starts: { start: number; title: string }[] = [
    ...alertableEvents(events, prefs, now).map((e) => ({ start: Date.parse(e.startsAt), title: `${e.name} (${e.region})` })),
    ...alertableUpdates(updates, prefs, now).map((u) => ({ start: Date.parse(u.downtimeStartsAt), title: u.name })),
  ];
  let best: { at: number; lead: AlertLead; title: string } | null = null;
  for (const s of starts) {
    for (const lead of LEADS) {
      const at = s.start - LEAD_MS[lead];
      if (at > now && (!best || at < best.at)) best = { at, lead, title: s.title };
    }
  }
  return best;
}
