import { useEffect } from "react";
import type { CompetitiveEvent } from "../types/events";
import { eventTypeLabel, FORMAT_LABEL, LOCAL_REGIONS, regionLabel } from "../utils/labels";

const SCRIPT_ID = "ld-competitive-events";
/** Cap the JSON-LD so a calendar with hundreds of events doesn't bloat the page head. */
const MAX_EVENTS = 40;

/**
 * Publishes upcoming/active competitive events as schema.org Event JSON-LD so search engines can surface them
 * (local regions first). Static site-level structured data lives in index.html.
 */
export function StructuredData({ events, now }: { events: CompetitiveEvent[]; now: number }) {
  const relevant = events
    .filter((e) => Date.parse(e.endsAt) > now)
    .sort((a, b) => Number(LOCAL_REGIONS.includes(b.region)) - Number(LOCAL_REGIONS.includes(a.region)) || Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, MAX_EVENTS);
  // Recompute only when the set changes, not on every clock tick.
  const key = relevant.map((e) => `${e.id}:${e.startsAt}:${e.cancelled ? 1 : 0}`).join("|");

  useEffect(() => {
    const graph = relevant.map((e) => {
      const rescheduled = !!e.previousStartsAt?.length;
      return {
        "@type": "Event",
        name: `${e.name}${e.round ? ` – ${e.round}` : ""} (${regionLabel(e.region)})`,
        description: e.description ?? [eventTypeLabel(e.type), e.format && FORMAT_LABEL[e.format], e.mode].filter(Boolean).join(" · "),
        startDate: e.startsAt,
        endDate: e.endsAt,
        eventStatus: e.cancelled
          ? "https://schema.org/EventCancelled"
          : rescheduled
            ? "https://schema.org/EventRescheduled"
            : "https://schema.org/EventScheduled",
        ...(rescheduled ? { previousStartDate: e.previousStartsAt } : {}),
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        location: { "@type": "VirtualLocation", url: e.sourceUrl ?? "https://www.fortnite.com/competitive" },
        organizer: { "@type": "Organization", name: "Epic Games", url: "https://www.epicgames.com" },
        ...(e.imageUrl ? { image: e.imageUrl } : {}),
      };
    });

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
  }, [key]); // keyed on the set of relevant events on purpose

  return null;
}
