import { useState } from "react";
import type { MapChange, POIRanking, Season } from "../types/intel";
import { usePersistentState } from "../hooks/usePersistentState";
import { getCurrentSeason, seasonName } from "../utils/seasons";
import {
  latestChangeFor,
  matchesPOIFilter,
  POI_FILTER_LABEL,
  POI_SORT_LABEL,
  rankPOIs,
  SCORE_WEIGHTS,
  type POIFilter,
  type POISort,
} from "../utils/poi";
import { ChipFilter } from "./ChipFilter";
import { MapChangesFeed } from "./MapChangesFeed";
import { POICard } from "./POICard";
import { SectionHeader } from "./SectionHeader";

const FILTERS = Object.keys(POI_FILTER_LABEL) as POIFilter[];
const SORTS = Object.keys(POI_SORT_LABEL) as POISort[];
const isFilter = (v: unknown): v is POIFilter => FILTERS.includes(v as POIFilter);
const isSort = (v: unknown): v is POISort => SORTS.includes(v as POISort);

const pct = (n: number) => `${Math.round(n * 100)}%`;

interface LandingSpotsProps {
  pois: POIRanking[];
  mapChanges: MapChange[];
  seasons: Season[];
  now: number;
}

export function LandingSpots({ pois, mapChanges, seasons, now }: LandingSpotsProps) {
  const [filter, setFilter] = usePersistentState<POIFilter>("poi-filter", "all", isFilter);
  const [sort, setSort] = usePersistentState<POISort>("poi-sort", "overall", isSort);
  const [showMethod, setShowMethod] = useState(false);

  // Rank the current season's island; fall back to everything if no season is running.
  const season = getCurrentSeason(seasons, now);
  const seasonPois = season ? pois.filter((p) => p.seasonId === season.id) : pois;
  const seasonChanges = season ? mapChanges.filter((c) => c.seasonId === season.id) : mapChanges;

  const ranked = rankPOIs(seasonPois, sort, filter);
  const withRank = ranked.filter((r) => r.rank !== null);
  const unranked = ranked.filter((r) => r.rank === null);

  const active = seasonPois.filter((p) => p.status === "active");
  const counts = Object.fromEntries(FILTERS.map((f) => [f, active.filter((p) => matchesPOIFilter(p, f)).length])) as Record<POIFilter, number>;
  const anyProvisional = ranked.some((r) => r.status === "provisional");

  return (
    <section className="section" aria-labelledby="landing">
      <SectionHeader
        id="landing"
        eyebrow="POI power rankings"
        title="Best Landing Spots"
        description={`Every named POI${season ? ` on ${season.mapName}` : ""} scored for loot, mobility, materials, contest rate and competitive value.`}
      >
        <div className="landing-controls">
          <ChipFilter
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            counts={counts}
            label={(f) => POI_FILTER_LABEL[f]}
            ariaLabel="Filter landing spots"
          />
          <label className="select">
            <span className="select__label">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as POISort)}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {POI_SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {anyProvisional && (
          <p className="landing-note">
            Early-season rankings: <strong>Provisional</strong> scores come from launch-week descriptions and get replaced as
            chest counts and community data come in.{" "}
            <button type="button" className="link-button" aria-expanded={showMethod} onClick={() => setShowMethod((v) => !v)}>
              How scores work
            </button>
          </p>
        )}
        {showMethod && (
          <p className="landing-method">
            Overall = loot {pct(SCORE_WEIGHTS.loot)} + competitive {pct(SCORE_WEIGHTS.competitive)} + mobility{" "}
            {pct(SCORE_WEIGHTS.mobility)} + materials {pct(SCORE_WEIGHTS.materials)} + survivability{" "}
            {pct(SCORE_WEIGHTS.survivability)} (the inverse of contest rate). Rankings follow the sort you pick.
          </p>
        )}
      </SectionHeader>

      <MapChangesFeed changes={seasonChanges} now={now} />

      {withRank.length > 0 ? (
        <div className="poi-grid">
          {withRank.map((r) => (
            <POICard key={r.poi.id} ranked={r} seasonName={seasonName(seasons, r.poi.seasonId)} latestChange={latestChangeFor(r.poi.id, mapChanges, now)} />
          ))}
        </div>
      ) : (
        <p className="empty-state">
          {sort === "chests" ? "No chest counts published yet for this island." : "No rated landing spots match this filter yet."}
        </p>
      )}

      {unranked.length > 0 && (
        <div className="unranked">
          <h3 className="unranked__title">
            {sort === "chests" ? "No chest count yet" : "Awaiting rating"} <span>({unranked.length})</span>
          </h3>
          <div className="poi-grid poi-grid--compact">
            {unranked.map((r) => (
              <POICard key={r.poi.id} ranked={r} seasonName={seasonName(seasons, r.poi.seasonId)} latestChange={latestChangeFor(r.poi.id, mapChanges, now)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
