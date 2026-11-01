import { describe, expect, it } from "vitest";
import type { CompetitiveEvent, UpdateEvent } from "../types/events";
import {
  getEventStatus,
  getLiveUpdateId,
  getNextItem,
  getScheduleStatus,
  getUpdateStatus,
  rankEvents,
  rankUpdates,
} from "./status";

const update = (id: string, start: string, end: string, extra: Partial<UpdateEvent> = {}): UpdateEvent => ({
  id,
  name: id,
  version: "1.00",
  kind: "patch",
  downtimeStartsAt: start,
  expectedEndAt: end,
  confidence: "official",
  ...extra,
});

const event = (id: string, start: string, end: string, extra: Partial<CompetitiveEvent> = {}): CompetitiveEvent => ({
  id,
  name: id,
  type: "cash-cup",
  region: "EU",
  mode: "Zero Build",
  format: "duos",
  startsAt: start,
  endsAt: end,
  requirements: { regionEligibility: ["EU"] },
  confidence: "official",
  ...extra,
});

const oldUpdate = update("v42", "2026-08-20T06:00:00Z", "2026-08-20T11:00:00Z");
const nextUpdate = update("v43", "2026-11-01T05:00:00Z", "2026-11-01T08:00:00Z");
const eos = update("eos", "2026-11-10T06:00:00Z", "2026-11-10T07:30:00Z", { kind: "service-maintenance", version: null });
const updates = [oldUpdate, nextUpdate, eos];

describe("update status", () => {
  it("moves upcoming → maintenance → live → completed", () => {
    const before = "2026-11-01T04:00:00Z";
    const during = "2026-11-01T06:00:00Z";
    const after = "2026-11-01T09:00:00Z";

    expect(getUpdateStatus(nextUpdate, before, getLiveUpdateId(updates, before))).toBe("upcoming");
    expect(getUpdateStatus(nextUpdate, during, getLiveUpdateId(updates, during))).toBe("maintenance");
    expect(getUpdateStatus(nextUpdate, after, getLiveUpdateId(updates, after))).toBe("live");
    // the previous version stops being "live" once the new one lands
    expect(getUpdateStatus(oldUpdate, before, getLiveUpdateId(updates, before))).toBe("live");
    expect(getUpdateStatus(oldUpdate, after, getLiveUpdateId(updates, after))).toBe("completed");
  });

  it("prefers the confirmed end over the estimate", () => {
    const overran = update("v43", "2026-11-01T05:00:00Z", "2026-11-01T08:00:00Z", { actualEndAt: "2026-11-01T10:00:00Z" });
    expect(getUpdateStatus(overran, "2026-11-01T09:00:00Z", null)).toBe("maintenance");
  });

  it("never marks service maintenance as the live game version", () => {
    expect(getLiveUpdateId(updates, "2026-11-11T00:00:00Z")).toBe("v43");
  });

  it("orders cards: down now, then upcoming soonest-first, then live, then past", () => {
    const during = "2026-11-01T06:00:00Z";
    expect(rankUpdates(updates, during).map((r) => `${r.update.id}:${r.status}`)).toEqual([
      "v43:maintenance",
      "eos:upcoming",
      "v42:live",
    ]);
  });
});

describe("headline schedule status", () => {
  it("is red during downtime, orange within 48h of one, green otherwise", () => {
    expect(getScheduleStatus(updates, "2026-11-01T06:00:00Z").level).toBe("down");
    expect(getScheduleStatus(updates, "2026-10-31T23:57:00Z").level).toBe("scheduled");
    expect(getScheduleStatus(updates, "2026-11-03T00:00:00Z").level).toBe("clear");
    expect(getScheduleStatus(updates, "2026-11-08T07:00:00Z").level).toBe("scheduled"); // EOS within 48h
  });
});

describe("competitive events", () => {
  const cup = event("cup", "2026-11-04T17:00:00Z", "2026-11-04T20:00:00Z");

  it("derives status from the schedule", () => {
    expect(getEventStatus(cup, "2026-11-04T16:00:00Z")).toBe("upcoming");
    expect(getEventStatus(cup, "2026-11-04T18:00:00Z")).toBe("active");
    expect(getEventStatus(cup, "2026-11-04T20:00:00Z")).toBe("finished");
  });

  it("orders active, then upcoming soonest-first, then finished newest-first", () => {
    const a = event("a", "2026-11-05T17:00:00Z", "2026-11-05T19:00:00Z");
    const b = event("b", "2026-11-03T17:00:00Z", "2026-11-03T19:00:00Z");
    const c = event("c", "2026-11-02T17:00:00Z", "2026-11-02T19:00:00Z");
    const now = "2026-11-04T18:00:00Z";
    expect(rankEvents([a, b, c, cup], now).map((r) => r.event.id)).toEqual(["cup", "a", "b", "c"]);
  });
});

describe("next item", () => {
  const cup = event("cup", "2026-11-01T03:00:00Z", "2026-11-01T05:30:00Z");

  it("picks whichever starts soonest", () => {
    expect(getNextItem(updates, [cup], "2026-11-01T00:00:00Z")).toMatchObject({ kind: "event", inProgress: false });
    expect(getNextItem(updates, [], "2026-11-01T00:00:00Z")).toMatchObject({ kind: "update", inProgress: false });
  });

  it("shows downtime in progress ahead of a running event", () => {
    const next = getNextItem(updates, [cup], "2026-11-01T05:15:00Z");
    expect(next).toMatchObject({ kind: "update", inProgress: true });
    expect(next?.at.toISOString()).toBe("2026-11-01T08:00:00.000Z");
  });

  it("returns null when nothing is ahead", () => {
    expect(getNextItem([oldUpdate], [], "2027-01-01T00:00:00Z")).toBeNull();
  });
});
