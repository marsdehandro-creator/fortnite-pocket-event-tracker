import { useState } from "react";
import type { CompetitiveEvent } from "../types/events";
import { usePersistentState } from "../hooks/usePersistentState";
import { FORMAT_LABEL, FORMATS } from "../utils/labels";
import { rankEvents } from "../utils/status";
import { EventCard } from "./EventCard";
import { FormatFilter, isFormatFilterValue, type FormatFilterValue } from "./FormatFilter";
import { SectionHeader } from "./SectionHeader";

export function EventsTracker({ events, now }: { events: CompetitiveEvent[]; now: number }) {
  const [format, setFormat] = usePersistentState<FormatFilterValue>("format-filter", "all", isFormatFilterValue);
  const [showFinished, setShowFinished] = useState(false);

  const ranked = rankEvents(events, now);
  const counts = { all: ranked.length } as Record<FormatFilterValue, number>;
  FORMATS.forEach((f) => (counts[f] = ranked.filter((r) => r.event.format === f).length));

  const filtered = format === "all" ? ranked : ranked.filter((r) => r.event.format === format);
  const current = filtered.filter((r) => r.status !== "finished");
  const finished = filtered.filter((r) => r.status === "finished");

  return (
    <section className="section" aria-labelledby="events">
      <SectionHeader
        id="events"
        eyebrow="Tournament hub"
        title="Competitive Events"
        description="Cash Cups, Victory Cups, FNCS, Creator and Ranked Cups — with eligibility and countdowns. South African players usually queue on EU or ME, highlighted in green."
      >
        <FormatFilter value={format} onChange={setFormat} counts={counts} />
      </SectionHeader>

      {current.length ? (
        <div className="card-grid">
          {current.map(({ event, status }) => (
            <EventCard key={event.id} event={event} status={status} now={now} />
          ))}
        </div>
      ) : (
        <p className="empty-state">
          No upcoming {format === "all" ? "" : `${FORMAT_LABEL[format].toLowerCase()} `}events listed yet. Epic usually
          publishes the next schedule a few days ahead.
        </p>
      )}

      {finished.length > 0 && (
        <div className="past-block">
          <button
            type="button"
            className="ghost-button"
            aria-expanded={showFinished}
            aria-controls="finished-events"
            onClick={() => setShowFinished((v) => !v)}
          >
            {showFinished ? "Hide" : "Show"} finished events ({finished.length})
          </button>
          {showFinished && (
            <div className="card-grid" id="finished-events">
              {finished.map(({ event, status }) => (
                <EventCard key={event.id} event={event} status={status} now={now} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
