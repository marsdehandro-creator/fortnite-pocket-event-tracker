import { describe, expect, it } from "vitest";
import type { CompetitiveEvent, UpdateEvent } from "../types/events";
import { buildIcs, eventToIcsEntry, icsEscape } from "./ics";
import {
  DEFAULT_ALERT_PREFS,
  isAlertPrefs,
  matchesAlertFilters,
  nextAlert,
  planDueAlerts,
  pruneSent,
  startsPhrase,
  toNotifications,
  type AlertPrefs,
} from "./plan";

const H = 3_600_000;
const START = Date.parse("2026-11-07T19:00:00+02:00");

const ev = (over: Partial<CompetitiveEvent> = {}): CompetitiveEvent => ({
  id: "trios-eu-1",
  name: "Trios Cash Cup",
  type: "cash-cup",
  region: "EU",
  mode: "Battle Royale",
  format: "trios",
  round: "Session 1",
  startsAt: "2026-11-07T19:00:00+02:00",
  endsAt: "2026-11-07T22:00:00+02:00",
  requirements: { regionEligibility: ["EU"] },
  confidence: "official",
  ...over,
});

const upd = (over: Partial<UpdateEvent> = {}): UpdateEvent => ({
  id: "v43-10",
  name: "v43.10 update",
  version: "43.10",
  kind: "patch",
  downtimeStartsAt: "2026-11-07T19:00:00+02:00",
  expectedEndAt: "2026-11-07T23:00:00+02:00",
  confidence: "official",
  ...over,
});

const on: AlertPrefs = { ...DEFAULT_ALERT_PREFS, enabled: true };
const plan = (now: number, opts: { events?: CompetitiveEvent[]; updates?: UpdateEvent[]; prefs?: AlertPrefs; sent?: Record<string, number> } = {}) =>
  planDueAlerts({ events: opts.events ?? [ev()], updates: opts.updates ?? [], prefs: opts.prefs ?? on, now, sent: opts.sent ?? {} });

describe("alert timing: exactly two alerts, 2 days and 2 hours before", () => {
  it("is silent before the 2-day mark", () => {
    expect(plan(START - 49 * H)).toEqual([]);
  });

  it("fires the 2-day alert from 48h before", () => {
    expect(plan(START - 48 * H).map((a) => a.key)).toEqual(["t:trios-eu-1:2d"]);
    expect(plan(START - 30 * H).map((a) => a.key)).toEqual(["t:trios-eu-1:2d"]);
  });

  it("switches to the 2-hour alert inside 2h, and stops at the start", () => {
    expect(plan(START - 2 * H).map((a) => a.key)).toEqual(["t:trios-eu-1:2h"]);
    expect(plan(START - 10 * 60_000).map((a) => a.key)).toEqual(["t:trios-eu-1:2h"]);
    expect(plan(START)).toEqual([]);
  });

  it("never repeats an alert that was already sent", () => {
    expect(plan(START - 40 * H, { sent: { "t:trios-eu-1:2d": START - 47 * H } })).toEqual([]);
    expect(plan(START - H, { sent: { "t:trios-eu-1:2d": START - 47 * H } }).map((a) => a.lead)).toEqual(["2h"]);
  });

  it("does nothing while alerts are switched off", () => {
    expect(plan(START - H, { prefs: { ...on, enabled: false } })).toEqual([]);
  });

  it("skips cancelled and time-TBD sessions", () => {
    expect(plan(START - H, { events: [ev({ cancelled: true })] })).toEqual([]);
    expect(plan(START - H, { events: [ev({ timeTbd: true })] })).toEqual([]);
  });

  it("alerts for scheduled updates 2 days and 2 hours before downtime", () => {
    const r = plan(START - H, { events: [], updates: [upd()] });
    expect(r.map((a) => a.key)).toEqual(["u:v43-10:2h"]);
    expect(plan(START - H, { events: [], updates: [upd()], prefs: { ...on, updates: false } })).toEqual([]);
  });
});

describe("alert filters", () => {
  it("defaults to the local regions and every type except Other", () => {
    expect(matchesAlertFilters(ev(), on)).toBe(true);
    expect(matchesAlertFilters(ev({ region: "NAC" }), on)).toBe(false);
    expect(matchesAlertFilters(ev({ name: "Solo Ranked Cup", type: "ranked-cup" }), on)).toBe(false); // "other"
  });

  it("treats an empty region/format list as 'all', and keeps events with an unknown format", () => {
    const all = { ...on, regions: [], formats: [] };
    expect(matchesAlertFilters(ev({ region: "OCE" }), all)).toBe(true);
    const duosOnly = { ...on, formats: ["duos" as const] };
    expect(matchesAlertFilters(ev(), duosOnly)).toBe(false);
    expect(matchesAlertFilters(ev({ format: undefined }), duosOnly)).toBe(true);
  });

  it("validates stored prefs", () => {
    expect(isAlertPrefs(DEFAULT_ALERT_PREFS)).toBe(true);
    expect(isAlertPrefs({ ...DEFAULT_ALERT_PREFS, categories: ["nope"] })).toBe(false);
    expect(isAlertPrefs(null)).toBe(false);
  });
});

describe("notifications", () => {
  it("names a single session and links to it", () => {
    const [n] = toNotifications(plan(START - 2 * H), START - 2 * H);
    expect(n.title).toBe("Trios Cash Cup starts in 2h");
    expect(n.body).toContain("Session 1 · EU");
    expect(n.url).toBe("./?event=trios-eu-1#events");
  });

  it("batches several sessions into one notification", () => {
    const events = [ev(), ev({ id: "b", name: "Squads Victory Cup" }), ev({ id: "c", name: "FNCS Heats", type: "fncs" })];
    const ns = toNotifications(plan(START - H, { events }), START - H);
    expect(ns).toHaveLength(1);
    expect(ns[0].title).toBe("3 tournament sessions start in the next 2 hours");
    expect(ns[0].keys).toHaveLength(3);
  });

  it("phrases the start time", () => {
    expect(startsPhrase(START, START - 45 * 60_000)).toBe("in 45 min");
    expect(startsPhrase(START, START - 2 * H)).toBe("in 2h");
    expect(startsPhrase(START, START - 48 * H)).toBe("on Sat 7 Nov · 19:00 SAST");
  });

  it("prunes old sent keys and previews the next alert", () => {
    expect(pruneSent({ old: 0, fresh: START }, START + H)).toEqual({ fresh: START });
    expect(nextAlert([ev()], [], on, START - 50 * H)).toEqual({ at: START - 48 * H, lead: "2d", title: "Trios Cash Cup (EU)" });
    expect(nextAlert([ev()], [], on, START - 30 * H)?.lead).toBe("2h");
  });
});

describe("calendar export", () => {
  it("writes a valid VEVENT with both reminders", () => {
    const ics = buildIcs([eventToIcsEntry(ev())], Date.parse("2026-11-04T10:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261107T170000Z");
    expect(ics).toContain("TRIGGER:-P2D");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics).toContain("UID:trios-eu-1@pocket-event-tracker");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("escapes text and marks cancelled sessions", () => {
    expect(icsEscape("a, b; c\nd")).toBe("a\\, b\\; c\\nd");
    expect(buildIcs([eventToIcsEntry(ev({ cancelled: true }))])).toContain("STATUS:CANCELLED");
  });
});
