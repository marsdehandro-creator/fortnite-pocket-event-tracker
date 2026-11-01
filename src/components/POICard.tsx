import type { MapChange } from "../types/intel";
import { FORMAT_LABEL, MAP_CHANGE_LABEL, PLAY_STYLE_LABEL } from "../utils/labels";
import type { RankedPOI } from "../utils/poi";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SourceLink } from "./SourceLink";

interface POICardProps {
  ranked: RankedPOI;
  seasonName: string;
  latestChange: MapChange | null;
}

function ScoreBar({ label, value, inverted = false }: { label: string; value: number; inverted?: boolean }) {
  return (
    <div className="score-bar">
      <span className="score-bar__label">{label}</span>
      <span className="score-bar__track" aria-hidden="true">
        <span className={`score-bar__fill${inverted ? " score-bar__fill--inverted" : ""}`} style={{ width: `${value * 10}%` }} />
      </span>
      <span className="score-bar__value">{value}/10</span>
    </div>
  );
}

const CHANGE_ICON: Record<MapChange["type"], string> = {
  added: "★",
  removed: "✕",
  buffed: "▲",
  nerfed: "▼",
  reworked: "↻",
  "map-update": "◆",
};

export function POICard({ ranked, seasonName, latestChange }: POICardProps) {
  const { poi, rank, overall, status } = ranked;
  const s = poi.scores;
  const tier = overall === null ? "none" : overall >= 8 ? "s" : overall >= 6.5 ? "a" : overall >= 5 ? "b" : "c";

  return (
    <article className={`poi poi--tier-${tier}`} id={`poi-${poi.id}`} aria-labelledby={`poi-${poi.id}-title`}>
      <header className="poi__header">
        <span className="poi__rank" aria-label={rank ? `Rank ${rank}` : "Not ranked"}>
          {rank ? `#${rank}` : "—"}
        </span>
        <div className="poi__heading">
          <h3 className="poi__name" id={`poi-${poi.id}-title`}>
            {poi.name}
          </h3>
          <p className="poi__where">
            {poi.mapArea} · {seasonName}
          </p>
        </div>
        {overall !== null && (
          <div className="poi__overall">
            <span className="poi__overall-value">{overall.toFixed(1)}</span>
            <span className="poi__overall-max">/10</span>
          </div>
        )}
      </header>

      <div className="poi__badges">
        {status === "provisional" && (
          <span className="status-badge status-badge--provisional" title="Early estimate from launch-week information — will be updated">
            Provisional
          </span>
        )}
        {status === "rated" && <span className="status-badge status-badge--rated">Rated</span>}
        {status === "unrated" && <span className="status-badge">Awaiting rating</span>}
        {latestChange && (
          <span className={`change-badge change-badge--${latestChange.type}`} title={latestChange.title}>
            <span aria-hidden="true">{CHANGE_ICON[latestChange.type]}</span> {MAP_CHANGE_LABEL[latestChange.type]}
          </span>
        )}
        {poi.chestCount !== undefined && <span className="status-badge">{poi.chestCount} chests</span>}
      </div>

      <p className="poi__description">{poi.description}</p>

      {s && (
        <div className="poi__scores">
          <ScoreBar label="Loot" value={s.loot} />
          <ScoreBar label="Competitive" value={s.competitive} />
          <ScoreBar label="Mobility" value={s.mobility} />
          <ScoreBar label="Materials" value={s.materials} />
          <ScoreBar label="Contest rate" value={s.contestRate} inverted />
        </div>
      )}

      {(poi.recommendedTeamSizes.length > 0 || poi.bestFor.length > 0) && (
        <dl className="poi__fit">
          {poi.recommendedTeamSizes.length > 0 && (
            <div>
              <dt>Team size</dt>
              <dd>{poi.recommendedTeamSizes.map((t) => FORMAT_LABEL[t]).join(" · ")}</dd>
            </div>
          )}
          {poi.bestFor.length > 0 && (
            <div>
              <dt>Best for</dt>
              <dd>{poi.bestFor.map((b) => PLAY_STYLE_LABEL[b]).join(" · ")}</dd>
            </div>
          )}
        </dl>
      )}

      {poi.highlights && poi.highlights.length > 0 && (
        <ul className="poi__highlights">
          {poi.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      {poi.rationale && <p className="poi__rationale">{poi.rationale}</p>}

      <footer className="card__footer">
        <ConfidenceBadge confidence={poi.confidence} />
        <SourceLink url={poi.sourceUrl} />
      </footer>
    </article>
  );
}
