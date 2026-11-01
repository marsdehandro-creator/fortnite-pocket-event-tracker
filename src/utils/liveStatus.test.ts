import { describe, expect, it } from "vitest";
import { parseEpicStatus } from "./liveStatus";

const comp = (id: string, name: string, status = "operational", group_id: string | null = "fn", group = false) => ({
  id,
  name,
  status,
  group,
  group_id,
});

const summary = (overrides: { services?: ReturnType<typeof comp>[]; incidents?: unknown[]; maint?: unknown[] } = {}) => ({
  components: [
    comp("fn", "Fortnite", "operational", null, true),
    comp("store", "Epic Games Store", "major_outage", null, true),
    ...(overrides.services ?? [comp("mm", "Matchmaking"), comp("login", "Login"), comp("gs", "Game Services")]),
  ],
  incidents: overrides.incidents ?? [],
  scheduled_maintenances: overrides.maint ?? [],
});

describe("parseEpicStatus", () => {
  it("reports online when every Fortnite service is operational, ignoring other Epic products", () => {
    expect(parseEpicStatus(summary(), 0)).toMatchObject({ level: "online", label: "Online", detail: "All systems operational", affected: [] });
  });

  it("reports degraded service and names what's affected", () => {
    const s = parseEpicStatus(summary({ services: [comp("mm", "Matchmaking", "degraded_performance"), comp("login", "Login")] }), 0);
    expect(s).toMatchObject({ level: "degraded", detail: "Issues with Matchmaking", affected: ["Matchmaking"] });
  });

  it("reports maintenance from component status or an in-progress maintenance window", () => {
    expect(parseEpicStatus(summary({ services: [comp("gs", "Game Services", "under_maintenance")] }), 0)?.level).toBe("maintenance");
    const maint = [{ name: "v43.10", status: "in_progress", components: [{ id: "gs" }] }];
    expect(parseEpicStatus(summary({ maint }), 0)?.level).toBe("maintenance");
    // a maintenance window on another product doesn't count
    expect(parseEpicStatus(summary({ maint: [{ name: "Store", status: "in_progress", components: [{ id: "store" }] }] }), 0)?.level).toBe("online");
  });

  it("reports down on a major outage, summarising long lists", () => {
    const services = ["a", "b", "c", "d"].map((id) => comp(id, id.toUpperCase(), "major_outage"));
    expect(parseEpicStatus(summary({ services }), 0)).toMatchObject({ level: "down", detail: "Outage: A, B +2 more" });
  });

  it("surfaces unresolved incidents that touch Fortnite", () => {
    const incidents = [
      { name: "Login issues", status: "investigating", shortlink: "https://stspg.io/x", components: [{ id: "login" }] },
      { name: "Store iOS issue", status: "investigating", components: [{ id: "store" }] },
    ];
    expect(parseEpicStatus(summary({ incidents }), 0)?.incident).toEqual({ name: "Login issues", url: "https://stspg.io/x" });
  });

  it("returns null for payloads without a Fortnite group", () => {
    expect(parseEpicStatus({ components: [] }, 0)).toBeNull();
    expect(parseEpicStatus(null, 0)).toBeNull();
    expect(parseEpicStatus("nope", 0)).toBeNull();
  });
});
