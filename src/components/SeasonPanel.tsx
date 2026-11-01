import type { MapDiscovery, POIRanking, Season } from "../types/intel";
import { formatDuration } from "../utils/countdown";
import { getCurrentSeason } from "../utils/seasons";
import { formatSASTShortDate } from "../utils/time";

interface SeasonPanelProps {
  now: number;
  seasons: Season[];
  pois: POIRanking[];
  discoveries: MapDiscovery[];
}

/** Hero strip: the season at a glance — island, lobby size, POIs, discoveries, time left. */
export function SeasonPanel({ now, seasons, pois, discoveries }: SeasonPanelProps) {
  const season = getCurrentSeason(seasons, now);
  if (!season) return null;

  const activePois = pois.filter((p) => p.seasonId === season.id && p.status === "active").length;
  const activeDiscoveries = discoveries.filter((d) => d.seasonId === season.id && d.status === "active").length;
  const day = Math.floor((now - Date.parse(season.startsAt)) / 86_400_000) + 1;

  const stats: { label: string; value: string }[] = [
    { label: "Island", value: season.mapName },
    { label: "Season day", value: String(day) },
    ...(season.playerCount ? [{ label: "Lobby", value: `${season.playerCount} players` }] : []),
    { label: "Named POIs", value: String(activePois) },
    { label: "Discoveries", value: String(activeDiscoveries) },
    {
      label: "Season ends",
      value: season.endsAt ? `${formatSASTShortDate(season.endsAt)} · in ${formatDuration(Date.parse(season.endsAt) - now)}` : "Not announced",
    },
  ];

  return (
    <article className="panel season-panel" aria-label="Current season">
      <div className="season-panel__head">
        <p className="panel__label">Season intel</p>
        <h3 className="season-panel__name">{season.name}</h3>
        {season.notes && <p className="season-panel__notes">{season.notes}</p>}
      </div>
      <dl className="season-stats">
        {stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
