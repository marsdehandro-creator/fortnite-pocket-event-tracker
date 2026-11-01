import { useState } from "react";
import type { TrackerData } from "../types/events";
import { formatDuration } from "../utils/countdown";
import { MAP_CHANGE_LABEL } from "../utils/labels";
import { orderMapChanges } from "../utils/poi";
import { getCurrentSeason } from "../utils/seasons";
import { formatSASTShortDate } from "../utils/time";
import { SparkIcon } from "./Icons";
import { useFocusTarget, type FocusRequest } from "./Panel";
import { SourceLink } from "./SourceLink";

const COLLAPSED_CHANGES = 4;

/** Expandable season intelligence: island stats + the map-changes timeline. */
export function SeasonIntel({ now, data, focus }: { now: number; data: TrackerData; focus: FocusRequest | null }) {
  const [allChanges, setAllChanges] = useState(false);
  const season = getCurrentSeason(data.seasons, now);
  const changes = season ? data.mapChanges.filter((c) => c.seasonId === season.id) : data.mapChanges;
  const ordered = orderMapChanges(changes, now);
  const shown = allChanges ? ordered : ordered.slice(0, COLLAPSED_CHANGES);

  useFocusTarget("change", focus, (id) => {
    if (ordered.findIndex((r) => r.change.id === id) >= COLLAPSED_CHANGES) setAllChanges(true);
  });

  const stats: { label: string; value: string }[] = season
    ? [
        { label: "Island", value: season.mapName },
        { label: "Season day", value: String(Math.floor((now - Date.parse(season.startsAt)) / 86_400_000) + 1) },
        ...(season.playerCount ? [{ label: "Lobby", value: `${season.playerCount} players` }] : []),
        { label: "Named POIs", value: String(data.pois.filter((p) => p.seasonId === season.id && p.status === "active").length) },
        { label: "Discoveries", value: String(data.discoveries.filter((d) => d.seasonId === season.id && d.status === "active").length) },
        {
          label: "Season ends",
          value: season.endsAt ? `${formatSASTShortDate(season.endsAt)} · in ${formatDuration(Date.parse(season.endsAt) - now)}` : "Not announced",
        },
      ]
    : [];

  return (
    <section className="season-intel" id="season-intel" aria-labelledby="season-intel-title">
      <header className="season-intel__head">
        <SparkIcon className="dash-panel__icon" />
        <h2 id="season-intel-title">{season ? `${season.name} intel` : "Season intel"}</h2>
        {season?.notes && <p className="season-intel__notes">{season.notes}</p>}
      </header>
      {stats.length > 0 && (
        <dl className="season-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {ordered.length > 0 && (
        <div className="map-changes">
          <h3 className="map-changes__title">Map changes</h3>
          <ol className="map-changes__list">
            {shown.map(({ change, scheduled }) => (
              <li key={change.id} className="map-change" id={`change-${change.id}`} tabIndex={-1}>
                <div className="map-change__meta">
                  <span className={`change-badge change-badge--${change.type}`}>{MAP_CHANGE_LABEL[change.type]}</span>
                  <span className="map-change__date">
                    {scheduled ? "Scheduled · " : ""}
                    {formatSASTShortDate(change.date)}
                  </span>
                </div>
                <p className="map-change__title">{change.title}</p>
                <p className="map-change__desc">{change.description}</p>
                <SourceLink url={change.sourceUrl} />
              </li>
            ))}
          </ol>
          {ordered.length > COLLAPSED_CHANGES && (
            <button type="button" className="text-button" aria-expanded={allChanges} onClick={() => setAllChanges((v) => !v)}>
              {allChanges ? "Show fewer changes" : `Show all ${ordered.length} changes`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
