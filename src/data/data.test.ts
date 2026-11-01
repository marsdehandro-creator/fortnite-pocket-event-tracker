import { describe, expect, it } from "vitest";
import { isCompetitiveEvent, isUpdateEvent, sanitizeList } from "../utils/validate";
import { findBrokenReferences, isMapChange, isMapDiscovery, isPOIRanking, isSeason } from "../utils/validateIntel";
import { getStaticData } from "./dataSource";
import updatesFile from "./updates.json";
import eventsFile from "./events.json";
import seasonsFile from "./seasons.json";
import discoveriesFile from "./discoveries.json";
import poisFile from "./pois.json";
import mapChangesFile from "./map-changes.json";

/** Guards the hand-curated JSON: a typo here would silently drop a card on the live site. */
describe("bundled data", () => {
  const files = [
    ["update", updatesFile.items, isUpdateEvent],
    ["competitive event", eventsFile.items, isCompetitiveEvent],
    ["season", seasonsFile.items, isSeason],
    ["discovery", discoveriesFile.items, isMapDiscovery],
    ["POI", poisFile.items, isPOIRanking],
    ["map change", mapChangesFile.items, isMapChange],
  ] as const;

  it.each(files)("every %s record is valid", (_label, items, guard) => {
    (items as readonly { id: string }[]).forEach((item) => expect((guard as (v: unknown) => boolean)(item), item.id).toBe(true));
  });

  it.each(files)("%s ids are unique within their file", (_label, items) => {
    const ids = (items as readonly { id: string }[]).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every seasonId and poiId points at a real record", () => {
    expect(findBrokenReferences(getStaticData())).toEqual([]);
  });

  it("nothing is lost between the files and what the app loads", () => {
    const data = getStaticData();
    expect(data.updates).toHaveLength(updatesFile.items.length);
    expect(data.events).toHaveLength(eventsFile.items.length);
    expect(data.seasons).toHaveLength(seasonsFile.items.length);
    expect(data.discoveries).toHaveLength(discoveriesFile.items.length);
    expect(data.pois).toHaveLength(poisFile.items.length);
    expect(data.mapChanges).toHaveLength(mapChangesFile.items.length);
  });
});

describe("sanitizeList", () => {
  it("drops invalid and duplicate records instead of throwing", () => {
    const good = updatesFile.items[0];
    const out = sanitizeList([good, { id: "broken" }, good], isUpdateEvent, "test");
    expect(out).toHaveLength(1);
  });

  it("rejects timestamps without an explicit offset", () => {
    const noOffset = { ...updatesFile.items[0], downtimeStartsAt: "2026-11-01T07:00:00" };
    expect(isUpdateEvent(noOffset)).toBe(false);
  });
});
