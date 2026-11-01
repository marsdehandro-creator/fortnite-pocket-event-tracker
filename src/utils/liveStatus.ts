/**
 * Live Fortnite service status from Epic's public Statuspage API (CORS-enabled, no key).
 * Only the "Fortnite" component group counts — other Epic products (Store, Rocket League…) are ignored.
 */

export const EPIC_STATUS_URL = "https://status.epicgames.com/api/v2/summary.json";
export const EPIC_STATUS_PAGE = "https://status.epicgames.com/";

export type LiveLevel = "online" | "degraded" | "maintenance" | "down";

export interface LiveStatus {
  level: LiveLevel;
  /** Headline, e.g. "Online". */
  label: string;
  /** One line under the headline, e.g. "All systems operational". */
  detail: string;
  /** Fortnite services that aren't operational. */
  affected: string[];
  /** Active incident touching Fortnite, if any. */
  incident?: { name: string; url?: string };
  checkedAt: number;
}

interface StatusComponent {
  id: string;
  name: string;
  status: string;
  group?: boolean;
  group_id?: string | null;
}

interface StatusEvent {
  name: string;
  status: string;
  shortlink?: string;
  components?: { id: string }[];
}

interface Summary {
  components?: StatusComponent[];
  incidents?: StatusEvent[];
  scheduled_maintenances?: StatusEvent[];
}

const SEVERITY: Record<string, number> = {
  operational: 0,
  degraded_performance: 1,
  partial_outage: 2,
  under_maintenance: 3,
  major_outage: 4,
};

/** Parses a Statuspage summary. Returns null when the payload has no Fortnite group (unexpected shape). */
export function parseEpicStatus(payload: unknown, now: number): LiveStatus | null {
  const data = payload as Summary;
  if (!data || !Array.isArray(data.components)) return null;

  const group = data.components.find((c) => c.group && c.name.trim().toLowerCase() === "fortnite");
  if (!group) return null;

  const services = data.components.filter((c) => c.group_id === group.id);
  const serviceIds = new Set([group.id, ...services.map((s) => s.id)]);
  const touchesFortnite = (e: StatusEvent) => (e.components ?? []).some((c) => serviceIds.has(c.id));

  const affected = services.filter((s) => s.status !== "operational").map((s) => s.name);
  const worst = Math.max(SEVERITY[group.status] ?? 0, ...services.map((s) => SEVERITY[s.status] ?? 0));

  const incident = (data.incidents ?? []).find((i) => i.status !== "resolved" && i.status !== "postmortem" && touchesFortnite(i));
  const maintenanceNow = (data.scheduled_maintenances ?? []).some((m) => m.status === "in_progress" && touchesFortnite(m));

  const list = (names: string[]) => (names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more` : names.join(" and "));

  let level: LiveLevel;
  let label: string;
  let detail: string;
  if (worst >= SEVERITY.major_outage) {
    level = "down";
    label = "Down";
    detail = affected.length ? `Outage: ${list(affected)}` : "Major outage reported";
  } else if (worst === SEVERITY.under_maintenance || maintenanceNow) {
    level = "maintenance";
    label = "Maintenance";
    detail = affected.length ? `Under maintenance: ${list(affected)}` : "Scheduled maintenance in progress";
  } else if (worst > 0) {
    level = "degraded";
    label = "Degraded";
    detail = `Issues with ${list(affected)}`;
  } else {
    level = "online";
    label = "Online";
    detail = "All systems operational";
  }

  return {
    level,
    label,
    detail,
    affected,
    incident: incident ? { name: incident.name, url: incident.shortlink } : undefined,
    checkedAt: now,
  };
}
