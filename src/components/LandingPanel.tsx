import { useState } from "react";
import type { TeamFormat } from "../types/events";
import type { MapChange, POIRanking, Season } from "../types/intel";
import { usePersistentState } from "../hooks/usePersistentState";
import { FORMAT_LABEL, MAP_CHANGE_LABEL, PLAY_STYLE_LABEL } from "../utils/labels";
import { latestChangeFor, POI_SORT_LABEL, rankPOIs, SCORE_WEIGHTS, type POIFilter, type POISort, type RankedPOI } from "../utils/poi";
import { getCurrentSeason } from "../utils/seasons";
import { POIThumb } from "./Artwork";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ChevronDown, PinIcon } from "./Icons";
import { Panel, useFocusTarget, type FocusRequest } from "./Panel";
import { SourceLink } from "./SourceLink";

const COLLAPSED_ROWS = 3;

const SORT_CHIPS: { value: POISort; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "loot", label: "Best Loot" },
  { value: "chests", label: "Most Chests" },
  { value: "contest", label: "Lowest Contest" },
  { value: "rotation", label: "Best Rotation" },
  { value: "competitive", label: "Competitive" },
];
const FILTER_CHIPS: { value: Exclude<POIFilter, "all">; label: string }[] = [
  { value: "solo", label: "Solos" },
  { value: "duos", label: "Duos" },
  { value: "trios", label: "Trios" },
  { value: "squads", label: "Squads" },
  { value: "competitive", label: "Comp Drops" },
  { value: "casual", label: "Casual" },
];
const isSort = (v: unknown): v is POISort => SORT_CHIPS.some((c) => c.value === v);
const isFilter = (v: unknown): v is POIFilter => v === "all" || FILTER_CHIPS.some((c) => c.value === v);

const pct = (n: number) => `${Math.round(n * 100)}%`;

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

function POIRow({ ranked, change, open, onToggle }: { ranked: RankedPOI; change: MapChange | null; open: boolean; onToggle: () => void }) {
  const { poi, rank, overall, status } = ranked;
  const s = poi.scores;
  const medal = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "none";
  const detailId = `poi-${poi.id}-detail`;
  const sub = status === "provisional" ? "Provisional" : status === "unrated" ? "Awaiting rating" : "Rated";

  return (
    <article className={`row row--poi${open ? " is-open" : ""}`} id={`poi-${poi.id}`}>
      <button type="button" className="row__main" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className={`rank-tile rank-tile--${medal}`} aria-label={rank ? `Rank ${rank}` : "Not ranked"}>
          {rank ?? "–"}
        </span>
        {poi.imageUrl ? <img className="poi-thumb" src={poi.imageUrl} alt="" loading="lazy" /> : <POIThumb id={poi.id} name={poi.name} />}
        <span className="row__titles">
          <span className="row__title">{poi.name}</span>
          <span className={`row__sub row__sub--${status}`}>
            {sub} · {poi.mapArea}
          </span>
        </span>
        <span className="row__stat row__stat--score">
          <span className="row__stat-label">Overall</span>
          <span className="row__stat-value">{overall !== null ? `${overall.toFixed(1)}/10` : "—"}</span>
        </span>
        {s && (
          <span className="subscores" aria-hidden="true">
            {(
              [
                ["Loot", s.loot],
                ["Mobility", s.mobility],
                ["Mats", s.materials],
                ["Contest", s.contestRate],
                ["Comp", s.competitive],
              ] as const
            ).map(([l, v]) => (
              <span key={l} className="subscore">
                <span className="subscore__label">{l}</span>
                <span className="subscore__value">{v}</span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown className="row__chev" />
      </button>
      {open && (
        <div className="row__detail" id={detailId}>
          {change && (
            <p className={`change-line change-line--${change.type}`}>
              <span className={`change-badge change-badge--${change.type}`}>{MAP_CHANGE_LABEL[change.type]}</span> {change.title}
            </p>
          )}
          <p>{poi.description}</p>
          {s && (
            <div className="score-bars">
              <ScoreBar label="Loot" value={s.loot} />
              <ScoreBar label="Competitive" value={s.competitive} />
              <ScoreBar label="Mobility" value={s.mobility} />
              <ScoreBar label="Materials" value={s.materials} />
              <ScoreBar label="Contest rate" value={s.contestRate} inverted />
            </div>
          )}
          {(poi.recommendedTeamSizes.length > 0 || poi.bestFor.length > 0) && (
            <dl className="facts facts--compact">
              {poi.recommendedTeamSizes.length > 0 && (
                <div className="facts__item">
                  <dt>Team size</dt>
                  <dd>{poi.recommendedTeamSizes.map((t: TeamFormat) => FORMAT_LABEL[t]).join(" · ")}</dd>
                </div>
              )}
              {poi.bestFor.length > 0 && (
                <div className="facts__item">
                  <dt>Best for</dt>
                  <dd>{poi.bestFor.map((b) => PLAY_STYLE_LABEL[b]).join(" · ")}</dd>
                </div>
              )}
              {poi.chestCount !== undefined && (
                <div className="facts__item">
                  <dt>Chests</dt>
                  <dd>{poi.chestCount}</dd>
                </div>
              )}
            </dl>
          )}
          {poi.highlights && poi.highlights.length > 0 && (
            <ul className="highlights">
              {poi.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          {poi.rationale && <p className="row__notes row__notes--italic">{poi.rationale}</p>}
          <div className="row__footer">
            <ConfidenceBadge confidence={poi.confidence} />
            <SourceLink url={poi.sourceUrl} />
          </div>
        </div>
      )}
    </article>
  );
}

interface LandingPanelProps {
  pois: POIRanking[];
  mapChanges: MapChange[];
  seasons: Season[];
  now: number;
  focus: FocusRequest | null;
}

export function LandingPanel({ pois, mapChanges, seasons, now, focus }: LandingPanelProps) {
  const [sort, setSort] = usePersistentState<POISort>("poi-sort", "overall", isSort);
  const [filter, setFilter] = usePersistentState<POIFilter>("poi-filter", "all", isFilter);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);

  const season = getCurrentSeason(seasons, now);
  const seasonPois = season ? pois.filter((p) => p.seasonId === season.id) : pois;
  const ranked = rankPOIs(seasonPois, sort, filter);
  const visible = expanded ? ranked : ranked.filter((r) => r.rank !== null).slice(0, COLLAPSED_ROWS);
  const anyProvisional = ranked.some((r) => r.status === "provisional");

  useFocusTarget("poi", focus, (id) => {
    setFilter("all");
    setExpanded(true);
    setOpenId(id);
  });

  return (
    <Panel
      id="landing"
      icon={<PinIcon />}
      title="Best Landing Spots"
      meta={season ? `POI Rankings (${season.name})` : "POI Rankings"}
    >
      <div className="segmented segmented--panel" role="group" aria-label="Sort and filter landing spots">
        {SORT_CHIPS.map((c) => (
          <button key={c.value} type="button" className="segmented__option" aria-pressed={sort === c.value} onClick={() => setSort(c.value)}>
            {c.label}
          </button>
        ))}
        <span className="segmented__divider" aria-hidden="true" />
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            className="segmented__option segmented__option--filter"
            aria-pressed={filter === c.value}
            onClick={() => setFilter((cur) => (cur === c.value ? "all" : c.value))}
          >
            {c.label}
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="rows">
          {visible.map((r) => (
            <POIRow
              key={r.poi.id}
              ranked={r}
              change={latestChangeFor(r.poi.id, mapChanges, now)}
              open={openId === r.poi.id}
              onToggle={() => setOpenId((cur) => (cur === r.poi.id ? null : r.poi.id))}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">
          {sort === "chests" ? "No chest counts published yet for this island." : "No rated landing spots match this filter yet."}
        </p>
      )}

      {(ranked.length > visible.length || expanded) && (
        <div className="panel-foot">
          <button type="button" className="text-button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show top 3 only" : `View all ${ranked.length} landing spots`}
          </button>
        </div>
      )}

      {anyProvisional && (
        <p className="panel-note">
          Early-season <strong>Provisional</strong> scores come from launch-week info and firm up as chest counts arrive.{" "}
          <button type="button" className="link-button" aria-expanded={showMethod} onClick={() => setShowMethod((v) => !v)}>
            How scores work
          </button>
          {showMethod && (
            <span className="panel-note__method">
              {" "}
              Overall = loot {pct(SCORE_WEIGHTS.loot)} + competitive {pct(SCORE_WEIGHTS.competitive)} + mobility {pct(SCORE_WEIGHTS.mobility)} + materials{" "}
              {pct(SCORE_WEIGHTS.materials)} + survivability {pct(SCORE_WEIGHTS.survivability)} (inverse of contest rate). {POI_SORT_LABEL[sort]} sets the order.
            </span>
          )}
        </p>
      )}
    </Panel>
  );
}
