import { describe, expect, it } from "vitest";
import { isCompetitiveEvent, isUpdateEvent, sanitizeList } from "../utils/validate";
import updatesFile from "./updates.json";
import eventsFile from "./events.json";

/** Guards the hand-curated JSON: a typo here would silently drop a card on the live site. */
describe("bundled data", () => {
  it("every update record is valid", () => {
    updatesFile.items.forEach((item) => expect(isUpdateEvent(item), item.id).toBe(true));
  });

  it("every competitive event record is valid", () => {
    eventsFile.items.forEach((item) => expect(isCompetitiveEvent(item), item.id).toBe(true));
  });

  it("ids are unique", () => {
    const ids = [...updatesFile.items, ...eventsFile.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
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
