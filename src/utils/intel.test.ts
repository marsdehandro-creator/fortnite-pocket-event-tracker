import { describe, expect, it } from "vitest";
import type { MapChange, MapDiscovery, POIRanking, Season } from "../types/intel";
import { countByCategory, filterDiscoveries, isNewDiscovery, matchesQuery, pickFeatured } from "./discoveries";
import { getRatingStatus, latestChangeFor, orderMapChanges, overallScore, rankPOIs } from "./poi";
import { getCurrentSeason } from "./seasons";
import { findBrokenReferences, isMapDiscovery, isPOIRanking } from "./validateIntel";

const disc = (id: string, extra: Partial<MapDiscovery> = {}): MapDiscovery => ({
  id,
  title: id,
  summary: "summary",
  mapArea: "Somewhere",
  category: "secret-location",
  rarity: "rare",
  seasonId: "s1",
  addedAt: "2026-11-01T10:00:00+02:00",
  status: "active",
  confidence: "official",
  ...extra,
});

const poi = (id: string, extra: Partial<POIRanking> = {}): POIRanking => ({
  id,
  name: id,
  seasonId: "s1",
  mapArea: "North",
  description: "d",
  status: "active",
  recommendedTeamSizes: ["duos"],
  bestFor: ["casual"],
  confidence: "official",
  updatedAt: "2026-11-01T10:00:00+02:00",
  ...extra,
});

const scores = (loot: number, competitive = 5, mobility = 5, materials = 5, contestRate = 5) => ({
  loot,
  competitive,
  mobility,
  materials,
  contestRate,
});

describe("discoveries", () => {
  it("flags discoveries as new for 7 days, never when archived", () => {
    const d = disc("a");
    expect(isNewDiscovery(d, "2026-11-05T00:00:00Z")).toBe(true);
    expect(isNewDiscovery(d, "2026-11-09T00:00:00Z")).toBe(false);
    expect(isNewDiscovery({ ...d, status: "archived", archivedAt: d.addedAt, archivedReason: "x" }, "2026-11-02T00:00:00Z")).toBe(false);
  });

  it("searches title, summary, details and area, accent- and case-insensitively", () => {
    const d = disc("a", { title: "Hidden Vault", details: "Behind the waterfall", mapArea: "Loguétown" });
    expect(matchesQuery(d, "vault")).toBe(true);
    expect(matchesQuery(d, "WATERFALL")).toBe(true);
    expect(matchesQuery(d, "loguetown vault")).toBe(true);
    expect(matchesQuery(d, "tunnel")).toBe(false);
  });

  it("filters by category and hides archived unless asked", () => {
    const list = [
      disc("a", { category: "loot-route" }),
      disc("b", { category: "easter-egg" }),
      disc("c", { category: "loot-route", status: "archived", archivedAt: "2026-11-02T00:00:00Z", archivedReason: "map update" }),
    ];
    expect(filterDiscoveries(list, { query: "", category: "loot-route", includeArchived: false }).map((d) => d.id)).toEqual(["a"]);
    expect(filterDiscoveries(list, { query: "", category: "loot-route", includeArchived: true })).toHaveLength(2);
    expect(countByCategory(list)).toMatchObject({ all: 3, "loot-route": 2, "easter-egg": 1 });
  });

  it("features the newest flagged discovery, else the rarest", () => {
    const list = [
      disc("old-flag", { featured: true, addedAt: "2026-10-01T00:00:00Z" }),
      disc("new-flag", { featured: true, addedAt: "2026-11-01T00:00:00Z" }),
      disc("legend", { rarity: "legendary" }),
    ];
    expect(pickFeatured(list)?.id).toBe("new-flag");
    expect(pickFeatured(list.filter((d) => !d.featured))?.id).toBe("legend");
    expect(pickFeatured([])).toBeNull();
  });
});

describe("POI scoring and ranking", () => {
  it("weights the overall score and inverts contest rate", () => {
    expect(overallScore(scores(10, 10, 10, 10, 0))).toBe(10);
    expect(overallScore(scores(0, 0, 0, 0, 10))).toBe(0);
    // quieter drop scores higher with everything else equal
    expect(overallScore(scores(7, 7, 7, 7, 2))).toBeGreaterThan(overallScore(scores(7, 7, 7, 7, 9)));
  });

  it("labels rating status from scores and confidence", () => {
    expect(getRatingStatus(poi("a"))).toBe("unrated");
    expect(getRatingStatus(poi("a", { scores: scores(5), rationale: "r", confidence: "estimated" }))).toBe("provisional");
    expect(getRatingStatus(poi("a", { scores: scores(5), rationale: "r" }))).toBe("rated");
  });

  it("ranks by the chosen sort, unscored last and unranked, removed POIs excluded", () => {
    const list = [
      poi("mid", { scores: scores(6, 9), rationale: "r" }),
      poi("top", { scores: scores(9, 5), rationale: "r", chestCount: 20 }),
      poi("none"),
      poi("gone", { status: "removed", scores: scores(10), rationale: "r" }),
    ];
    const byLoot = rankPOIs(list, "loot");
    expect(byLoot.map((r) => [r.poi.id, r.rank])).toEqual([
      ["top", 1],
      ["mid", 2],
      ["none", null],
    ]);
    expect(rankPOIs(list, "competitive")[0].poi.id).toBe("mid");
    expect(rankPOIs(list, "chests").map((r) => r.rank)).toEqual([1, null, null]);
  });

  it("filters by team size and play style", () => {
    const list = [
      poi("solo-ranked", { recommendedTeamSizes: ["solo"], bestFor: ["ranked"] }),
      poi("squad-casual", { recommendedTeamSizes: ["squads"], bestFor: ["casual"] }),
    ];
    expect(rankPOIs(list, "overall", "solo").map((r) => r.poi.id)).toEqual(["solo-ranked"]);
    expect(rankPOIs(list, "overall", "competitive").map((r) => r.poi.id)).toEqual(["solo-ranked"]);
    expect(rankPOIs(list, "overall", "casual").map((r) => r.poi.id)).toEqual(["squad-casual"]);
  });
});

describe("map changes", () => {
  const change = (id: string, date: string, poiId?: string): MapChange => ({
    id,
    date,
    seasonId: "s1",
    type: "buffed",
    title: id,
    description: "d",
    poiId,
    confidence: "official",
  });
  const now = "2026-11-03T00:00:00Z";
  const changes = [
    change("past-old", "2026-11-01T00:00:00Z", "p"),
    change("past-new", "2026-11-02T00:00:00Z", "p"),
    change("future", "2026-11-07T00:00:00Z", "p"),
  ];

  it("uses the latest change already in effect for a POI badge", () => {
    expect(latestChangeFor("p", changes, now)?.id).toBe("past-new");
    expect(latestChangeFor("other", changes, now)).toBeNull();
  });

  it("lists scheduled changes first, then the newest past changes", () => {
    expect(orderMapChanges(changes, now).map((r) => `${r.change.id}:${r.scheduled}`)).toEqual([
      "future:true",
      "past-new:false",
      "past-old:false",
    ]);
  });
});

describe("seasons", () => {
  const seasons: Season[] = [
    { id: "old", name: "Old", mapName: "A", startsAt: "2026-08-20T08:00:00+02:00", endsAt: "2026-11-01T07:00:00+02:00" },
    { id: "new", name: "New", mapName: "B", startsAt: "2026-11-01T10:12:00+02:00" },
  ];

  it("picks the season that is running", () => {
    expect(getCurrentSeason(seasons, "2026-10-01T00:00:00Z")?.id).toBe("old");
    expect(getCurrentSeason(seasons, "2026-11-01T06:00:00Z")).toBeNull(); // downtime gap between seasons
    expect(getCurrentSeason(seasons, "2026-11-02T00:00:00Z")?.id).toBe("new");
  });
});

describe("intel validation", () => {
  it("requires archive details on archived discoveries only", () => {
    expect(isMapDiscovery(disc("a"))).toBe(true);
    expect(isMapDiscovery(disc("a", { status: "archived" }))).toBe(false);
    expect(isMapDiscovery(disc("a", { status: "archived", archivedAt: "2026-11-02T00:00:00Z", archivedReason: "Removed in v43.10" }))).toBe(true);
    expect(isMapDiscovery(disc("a", { archivedReason: "stray" }))).toBe(false);
    expect(isMapDiscovery(disc("a", { lootRating: 6 }))).toBe(false);
  });

  it("requires a rationale for scored POIs and keeps scores within 0–10", () => {
    expect(isPOIRanking(poi("a", { scores: scores(5) }))).toBe(false);
    expect(isPOIRanking(poi("a", { scores: scores(5), rationale: "why" }))).toBe(true);
    expect(isPOIRanking(poi("a", { scores: scores(11), rationale: "why" }))).toBe(false);
  });

  it("reports references to unknown seasons and POIs", () => {
    const problems = findBrokenReferences({
      seasons: [{ id: "s1", name: "S", mapName: "M", startsAt: "2026-11-01T00:00:00Z" }],
      pois: [poi("p")],
      discoveries: [disc("ok", { poiId: "p" }), disc("bad", { poiId: "nope", seasonId: "s9" })],
      mapChanges: [],
    });
    expect(problems).toEqual(['discovery "bad" → unknown seasonId "s9"', 'discovery "bad" → unknown poiId "nope"']);
  });
});
