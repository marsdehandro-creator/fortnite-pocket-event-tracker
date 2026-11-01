import { useEffect } from "react";
import type { CompetitiveEvent } from "../types/events";
import { EVENT_TYPE_LABEL, FORMAT_LABEL, REGION_LABEL } from "../utils/labels";

const SCRIPT_ID = "ld-competitive-events";

/**
 * Publishes upcoming/active competitive events as schema.org Event JSON-LD so search engines can surface them.
 * Static site-level structured data lives in index.html.
 */
export function StructuredData({ events, now }: { events: CompetitiveEvent[]; now: number }) {
  // Recompute only when the data changes or an event finishes, not on every clock tick.
  const relevant = events.filter((e) => Date.parse(e.endsAt) > now);
  const key = relevant.map((e) => e.id).join("|");

  useEffect(() => {
    const graph = relevant.map((e) => ({
      "@type": "Event",
      name: `${e.name}${e.round ? ` – ${e.round}` : ""} (${REGION_LABEL[e.region]})`,
      description: `${EVENT_TYPE_LABEL[e.type]} · ${FORMAT_LABEL[e.format]} · ${e.mode}`,
      startDate: e.startsAt,
      endDate: e.endsAt,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      location: { "@type": "VirtualLocation", url: e.sourceUrl ?? "https://www.fortnite.com/competitive" },
      organizer: { "@type": "Organization", name: "Epic Games", url: "https://www.epicgames.com" },
    }));

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!graph.length) {
      script?.remove();
      return;
    }
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = SCRIPT_ID;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }, [key]); // keyed on the set of relevant ids on purpose

  return null;
}
