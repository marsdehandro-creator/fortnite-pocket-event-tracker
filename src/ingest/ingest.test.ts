import { describe, expect, it } from "vitest";
import type { CompetitiveEvent, SyncLog, SyncRun } from "../types/events";
import { deriveType, detectFormat, epicEventId, normalizeEpicWindow, normalizeEventName, parseRequirements, toSastIso, toTypeSlug, type RawEpicWindow } from "./epic";
import { fuzzyKey, mergeTournaments } from "./merge";
import { appendRun, isSyncDue } from "./syncLog";

const raw = (over: Partial<RawEpicWindow> = {}): RawEpicWindow => ({
  windowId: "S43_TriosCashCup_Event1_EU",
  groupId: "S43_TriosCashCup",
  tournamentName: "Trios Cash Cup Battle Royale",
  roundName: "Session 1 - Round 1",
  state: "upcoming",
  beginTime: "2026-11-07T14:00:00Z",
  endTime: "2026-11-07T17:00:00Z",
  requirements: ["eula:s43_trioscashcup_rules", "adps:g-1", "mfa", ["currentRanking:ranked-br-combined:12"]],
  roundType: "Qualifiers",
  region: "EU",
  ...over,
});

const group = { groupId: "S43_TriosCashCup", eventName: "Trios Cash Cup", mode: "Battle Royale", tournamentType: "CashCup", minimumAccountLevel: 350, playlistId: "Playlist_ShowdownTournament_FN_Trios", description: "Win a cash prize." };

const event = (id: string, over: Partial<CompetitiveEvent> = {}): CompetitiveEvent => ({
  id,
  name: "Trios Cash Cup",
  type: "cash-cup",
  region: "EU",
  mode: "Battle Royale",
  format: "trios",
  startsAt: "2026-11-07T16:00:00+02:00",
  endsAt: "2026-11-07T19:00:00+02:00",
  requirements: { regionEligibility: ["EU"] },
  confidence: "official",
  sourceId: id.toUpperCase(),
  ...over,
});

describe("normalising Epic data", () => {
  it("cleans names: dashes, spacing, ALL CAPS, trailing region tags", () => {
    expect(normalizeEventName("  FNCS   Solos Reload Qualifiers – EU ")).toBe("FNCS Solos Reload Qualifiers");
    expect(normalizeEventName("LIMITED TESTING EVENT")).toBe("Limited Testing Event");
    expect(normalizeEventName("ZB OG CUP (NAE)")).toBe("ZB OG Cup");
  });

  it("turns Epic types into slugs, and derives a type when Epic gives none — any name works", () => {
    expect(toTypeSlug("CashCup")).toBe("cash-cup");
    expect(toTypeSlug("PerformanceEvaluation")).toBe("performance-evaluation");
    expect(deriveType("Fortnite Performance Evaluation")).toBe("performance-evaluation");
    expect(deriveType("Duos Reload Ranked Cup")).toBe("ranked-cup");
    expect(deriveType("FNCS Solos Reload Heats")).toBe("fncs");
    expect(deriveType("Galactic Brawl Showdown")).toBe("galactic-brawl-showdown"); // an unknown, future type
    expect(deriveType("Trios Cash Cup", "CashCup")).toBe("cash-cup");
    expect(deriveType("Arenas Cash Cup", "Other")).toBe("arenas-cash-cup"); // Epic's catch-all falls back to the name
  });

  it("detects the team format from the playlist id or name, and leaves it unknown otherwise", () => {
    expect(detectFormat("Playlist_ShowdownTournament_FN_Trios")).toBe("trios");
    expect(detectFormat(undefined, "Reload ZB Duos Cash Cup")).toBe("duos");
    expect(detectFormat("Playlist_Something", "Arenas Test Cup")).toBeUndefined();
  });

  it("decodes only requirements it's sure about", () => {
    const r = parseRequirements(["mfa", "eula:x", "adps:y", ["currentRanking:ranked-br-combined:12"]], { groupId: "g", minimumAccountLevel: 350, systemFeatures: ["SecureBoot"] });
    expect(r.twoFactorRequired).toBe(true);
    expect(r.minAccountLevel).toBe(350);
    expect(r.other).toEqual(["Ranked rank requirement — see the event description", "Accept the event rules in-game", "PC: Secure Boot, TPM and IOMMU enabled"]);
  });

  it("builds a full, valid event in SAST with a stable id", () => {
    const r = normalizeEpicWindow(raw(), group);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event).toMatchObject({
      id: "epic-s43-trioscashcup-event1-eu",
      name: "Trios Cash Cup",
      type: "cash-cup",
      region: "EU",
      format: "trios",
      mode: "Battle Royale",
      startsAt: "2026-11-07T16:00:00+02:00",
      endsAt: "2026-11-07T19:00:00+02:00",
      confidence: "official",
      sourceId: "S43_TriosCashCup_Event1_EU",
      description: "Win a cash prize.",
      requirements: { regionEligibility: ["EU"], twoFactorRequired: true, minAccountLevel: 350 },
    });
    expect(epicEventId("S43_X_Event1_EU")).toBe("epic-s43-x-event1-eu");
  });

  it("still ingests an event with no group details and an unknown type", () => {
    const r = normalizeEpicWindow(raw({ windowId: "S44_Mystery_EU", groupId: "S44_Mystery", tournamentName: "Mystery Showdown", requirements: undefined }), undefined);
    expect(r.ok && r.event.type).toBe("mystery-showdown");
    expect(r.ok && r.event.format).toBeUndefined();
  });

  it("rejects invalid dates instead of storing them", () => {
    expect(normalizeEpicWindow(raw({ endTime: "2026-11-07T13:00:00Z" }), group).ok).toBe(false);
    expect(normalizeEpicWindow(raw({ beginTime: "not a date" }), group).ok).toBe(false);
    expect(toSastIso("2026-11-07T22:30:00Z")).toBe("2026-11-08T00:30:00+02:00");
  });
});

describe("merging into stored tournaments", () => {
  const now = new Date("2026-11-04T10:00:00Z");
  const base = { current: [] as CompetitiveEvent[], archive: [] as CompetitiveEvent[], coveredRegions: ["EU"], now };

  it("adds new events and never duplicates on re-sync", () => {
    const first = mergeTournaments({ ...base, incoming: [event("a"), event("a")] });
    expect(first.current).toHaveLength(1);
    expect(first.counts).toMatchObject({ discovered: 1, added: 1 });
    const second = mergeTournaments({ ...base, current: first.current, incoming: [event("a")] });
    expect(second.current).toHaveLength(1);
    expect(second.counts).toMatchObject({ added: 0, unchanged: 1 });
    expect(second.current[0].firstSeenAt).toBe(first.current[0].firstSeenAt);
  });

  it("updates existing records in place", () => {
    const first = mergeTournaments({ ...base, incoming: [event("a")] }).current;
    const next = mergeTournaments({ ...base, current: first, incoming: [event("a", { description: "New details" })] });
    expect(next.current).toHaveLength(1);
    expect(next.current[0].description).toBe("New details");
    expect(next.counts.updated).toBe(1);
  });

  it("tracks reschedules, keeping the old start time", () => {
    const first = mergeTournaments({ ...base, incoming: [event("a")] }).current;
    const moved = mergeTournaments({ ...base, current: first, incoming: [event("a", { startsAt: "2026-11-08T16:00:00+02:00", endsAt: "2026-11-08T19:00:00+02:00" })] });
    expect(moved.counts.rescheduled).toBe(1);
    expect(moved.current[0].previousStartsAt).toEqual(["2026-11-07T16:00:00+02:00"]);
  });

  it("marks future events that vanish from a captured region as cancelled — and restores them if they return", () => {
    const first = mergeTournaments({ ...base, incoming: [event("a"), event("b")] }).current;
    const gone = mergeTournaments({ ...base, current: first, incoming: [event("a")] });
    expect(gone.current).toHaveLength(2); // never deleted
    expect(gone.current.find((e) => e.id === "b")).toMatchObject({ cancelled: true });
    expect(gone.counts.cancelled).toBe(1);
    const back = mergeTournaments({ ...base, current: gone.current, incoming: [event("a"), event("b")] });
    expect(back.current.find((e) => e.id === "b")?.cancelled).toBeUndefined();
    expect(back.counts.restored).toBe(1);
  });

  it("doesn't cancel anything in a region whose capture failed, or events that already finished", () => {
    const first = mergeTournaments({ ...base, incoming: [event("a"), event("old", { startsAt: "2026-11-01T16:00:00+02:00", endsAt: "2026-11-01T19:00:00+02:00" })] }).current;
    const failedRegion = mergeTournaments({ ...base, coveredRegions: [], current: first, incoming: [] });
    expect(failedRegion.counts.cancelled).toBe(0);
    const finished = mergeTournaments({ ...base, current: first, incoming: [event("a")] });
    expect(finished.current.find((e) => e.id === "old")?.cancelled).toBeUndefined();
  });

  it("supersedes a hand-entered duplicate with Epic's official record", () => {
    const legacy: CompetitiveEvent = { ...event("trios-cash-cup-eu-1", { confidence: "estimated" }), sourceId: undefined };
    const merged = mergeTournaments({ ...base, current: [legacy], incoming: [event("epic-s43-trioscashcup-event1-eu", { name: "Trios Cash Cups" })] });
    expect(merged.current.map((e) => e.id)).toEqual(["epic-s43-trioscashcup-event1-eu"]);
    expect(merged.current[0].confidence).toBe("official");
    expect(fuzzyKey({ name: "FNCS Solos Reload Qualifiers", region: "EU", startsAt: "2026-11-04T20:00:00+02:00" })).toBe(
      fuzzyKey({ name: "FNCS Solo Reload Qualifier", region: "EU", startsAt: "2026-11-04T21:00:00+02:00" }),
    );
  });

  it("archives old events instead of deleting them", () => {
    const old = event("old", { startsAt: "2026-08-01T16:00:00+02:00", endsAt: "2026-08-01T19:00:00+02:00" });
    const merged = mergeTournaments({ ...base, current: [old, event("a")], incoming: [event("a")] });
    expect(merged.current.map((e) => e.id)).toEqual(["a"]);
    expect(merged.archive.map((e) => e.id)).toEqual(["old"]);
    expect(merged.counts.archived).toBe(1);
  });
});

describe("sync log and the 3-day schedule", () => {
  const run = (status: SyncRun["status"], finishedAt: string): SyncRun => ({
    startedAt: finishedAt,
    finishedAt,
    status,
    source: "test",
    regions: ["EU"],
    discovered: 1,
    added: 1,
    updated: 0,
    unchanged: 0,
    rescheduled: 0,
    cancelled: 0,
    restored: 0,
    rejected: 0,
    archived: 0,
    errors: [],
    warnings: [],
  });

  it("is due when nothing has ever synced", () => {
    expect(isSyncDue({ runs: [] }, new Date()).due).toBe(true);
  });

  it("waits 72 hours after a successful sync (with a small tolerance for scheduler jitter)", () => {
    const log: SyncLog = appendRun({ runs: [] }, run("success", "2026-11-04T08:30:00+02:00"));
    expect(isSyncDue(log, new Date("2026-11-06T08:30:00+02:00")).due).toBe(false); // 48h
    expect(isSyncDue(log, new Date("2026-11-07T06:45:00+02:00")).due).toBe(true); // 70.25h
  });

  it("retries the next day after a failed or partial run — only success resets the clock", () => {
    let log: SyncLog = appendRun({ runs: [] }, run("success", "2026-11-01T08:30:00+02:00"));
    log = appendRun(log, run("failed", "2026-11-04T08:30:00+02:00"));
    expect(log.lastSuccessAt).toBe("2026-11-01T08:30:00+02:00");
    expect(log.lastAttemptAt).toBe("2026-11-04T08:30:00+02:00");
    expect(isSyncDue(log, new Date("2026-11-05T08:30:00+02:00")).due).toBe(true);
  });
});

describe("details captured earlier survive a lighter re-sync", () => {
  it("keeps description, rules and image when the new capture lacks them", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    const first = mergeTournaments({ current: [], archive: [], coveredRegions: ["EU"], now, incoming: [event("a", { description: "Cash prize", rulesUrl: "https://x/rules", imageUrl: "https://x/i.jpg" })] }).current;
    const next = mergeTournaments({ current: first, archive: [], coveredRegions: ["EU"], now, incoming: [event("a")] });
    expect(next.current[0]).toMatchObject({ description: "Cash prize", rulesUrl: "https://x/rules", imageUrl: "https://x/i.jpg" });
    expect(next.counts.unchanged).toBe(1);
  });
});
