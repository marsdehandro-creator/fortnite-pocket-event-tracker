import { describe, expect, it } from "vitest";
import type { CompetitiveEvent } from "../types/events";
import { eventTypeLabel, humanizeSlug, regionLabel } from "./labels";
import { availableRegions, classifyTournament, daysRemainingLabel, modeShort } from "./tournaments";

const ev = (over: Partial<CompetitiveEvent>): CompetitiveEvent => ({
  id: "x",
  name: "Some Cup",
  type: "tournament",
  region: "EU",
  mode: "Battle Royale",
  startsAt: "2026-11-07T16:00:00+02:00",
  endsAt: "2026-11-07T19:00:00+02:00",
  requirements: { regionEligibility: ["EU"] },
  confidence: "official",
  ...over,
});

describe("tournament classification (filter buckets, never exclusion)", () => {
  it.each([
    ["FNCS Solos Reload Qualifiers", "fncs", "fncs"],
    ["Trios Cash Cup", "cash-cup", "cash-cup"],
    ["Squads Victory Cup", "victory-cup", "cash-cup"],
    ["Weezy Icon Cup", "icon-cup", "skin-cup"],
    ["Skull Trooper Skin Cup", "skin-cup", "skin-cup"],
    ["Creator Community Cup", "community-cup", "community"],
    ["Pro Invitational", "invitational", "invitational"],
    ["Fortnite Performance Evaluation", "performance-evaluation", "other"],
    ["Galactic Brawl Showdown", "galactic-brawl-showdown", "other"],
  ] as const)("%s → %s", (name, type, expected) => {
    expect(classifyTournament(ev({ name, type }))).toBe(expected);
  });

  it("uses Epic's raw type too", () => {
    expect(classifyTournament(ev({ name: "Weekly Event", type: "weekly-event", epicType: "CashCup" }))).toBe("cash-cup");
  });

  it("treats an explicit invite-only description as invitational, but ignores loose prize wording", () => {
    const fightNight = ev({ name: "Arenas Fight Night", type: "arenas-fight-night", description: "An invite-only 1v1 event … for cash prizes." });
    expect(classifyTournament(fightNight)).toBe("invitational");
    expect(classifyTournament(ev({ name: "Performance Evaluation", type: "workshop-cup", description: "Cash prizes will be awarded." }))).toBe("other");
    expect(classifyTournament(ev({ name: "FNCS Heats", type: "fncs", description: "Invite-only heats." }))).toBe("fncs");
  });
});

describe("labels for open-ended values", () => {
  it("humanises unknown types and keeps known acronyms", () => {
    expect(eventTypeLabel("cash-cup")).toBe("Cash Cup");
    expect(eventTypeLabel("performance-evaluation")).toBe("Performance Evaluation");
    expect(humanizeSlug("zb-og-cup")).toBe("ZB OG Cup");
  });

  it("names known regions and shows unknown codes as-is", () => {
    expect(regionLabel("NAE")).toBe("NA East");
    expect(regionLabel("SAF")).toBe("SAF");
  });

  it("lists regions present in the data, local ones first", () => {
    expect(availableRegions([ev({ region: "NAW" }), ev({ region: "ME" }), ev({ region: "EU" }), ev({ region: "ASIA" })], ["EU", "ME"])).toEqual(["EU", "ME", "ASIA", "NAW"]);
  });
});

describe("days remaining", () => {
  const e = ev({});
  it.each([
    ["2026-11-04T10:00:00+02:00", "Starts in 3 days"],
    ["2026-11-06T10:00:00+02:00", "Starts tomorrow"],
    ["2026-11-07T10:00:00+02:00", "Starts in 6h"],
    ["2026-11-07T17:00:00+02:00", "Live · 2h left"],
    ["2026-11-07T22:00:00+02:00", "Ended today"],
    ["2026-11-10T10:00:00+02:00", "Ended 3 days ago"],
  ])("at %s → %s", (now, label) => {
    expect(daysRemainingLabel(e, now)).toBe(label);
  });

  it("says cancelled for cancelled events", () => {
    expect(daysRemainingLabel(ev({ cancelled: true }), "2026-11-04T10:00:00+02:00")).toBe("Cancelled");
  });
});

describe("mode tag (tells parallel Build / Zero Build cups apart)", () => {
  it("hides plain Battle Royale and shortens the rest", () => {
    expect(modeShort("Battle Royale")).toBeNull();
    expect(modeShort("Zero Build")).toBe("ZB");
    expect(modeShort("Battle Royale · Reload")).toBe("Reload");
    expect(modeShort("Zero Build · Reload")).toBe("ZB Reload");
    expect(modeShort("Performance Evaluation")).toBe("Performance Evaluation");
  });
});
