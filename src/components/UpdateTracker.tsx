import { useState } from "react";
import type { UpdateEvent } from "../types/events";
import { rankUpdates } from "../utils/status";
import { SectionHeader } from "./SectionHeader";
import { UpdateCard } from "./UpdateCard";

export function UpdateTracker({ updates, now }: { updates: UpdateEvent[]; now: number }) {
  const [showPast, setShowPast] = useState(false);
  const ranked = rankUpdates(updates, now);
  const current = ranked.filter((r) => r.status !== "completed");
  const past = ranked.filter((r) => r.status === "completed");

  return (
    <section className="section" aria-labelledby="updates">
      <SectionHeader
        id="updates"
        eyebrow="Status center"
        title="Update & Downtime Tracker"
        description="Patches, season launches and maintenance windows, with live countdowns and running downtime."
      >
        <ul className="legend" aria-label="Status colours">
          <li>
            <span className="dot dot--green" aria-hidden="true" /> Live
          </li>
          <li>
            <span className="dot dot--orange" aria-hidden="true" /> Scheduled
          </li>
          <li>
            <span className="dot dot--red" aria-hidden="true" /> Down
          </li>
        </ul>
      </SectionHeader>

      {current.length ? (
        <div className="card-grid">
          {current.map(({ update, status }) => (
            <UpdateCard key={update.id} update={update} status={status} now={now} />
          ))}
        </div>
      ) : (
        <p className="empty-state">No updates or maintenance announced right now.</p>
      )}

      {past.length > 0 && (
        <div className="past-block">
          <button
            type="button"
            className="ghost-button"
            aria-expanded={showPast}
            aria-controls="past-updates"
            onClick={() => setShowPast((v) => !v)}
          >
            {showPast ? "Hide" : "Show"} past updates ({past.length})
          </button>
          {showPast && (
            <div className="card-grid" id="past-updates">
              {past.map(({ update, status }) => (
                <UpdateCard key={update.id} update={update} status={status} now={now} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
