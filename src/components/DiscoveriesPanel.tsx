import { useRef, useState } from "react";
import type { DiscoveryCategory, MapDiscovery, Season } from "../types/intel";
import { usePersistentState } from "../hooks/usePersistentState";
import { countByCategory, filterDiscoveries, isNewDiscovery, pickFeatured } from "../utils/discoveries";
import { DISCOVERY_CATEGORY_LABEL, DISCOVERY_RARITY_LABEL } from "../utils/labels";
import { seasonName } from "../utils/seasons";
import { formatSASTShortDate } from "../utils/time";
import { DISCOVERY_CATEGORIES } from "../utils/validateIntel";
import { DiscoveryArt } from "./Artwork";
import { ChipFilter } from "./ChipFilter";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ChevronRight, CloseIcon, MapIcon, SearchIcon } from "./Icons";
import { LootRating, Panel, useFocusTarget, type FocusRequest } from "./Panel";
import { SourceLink } from "./SourceLink";

type CategoryValue = DiscoveryCategory | "all";
const CATEGORY_OPTIONS: CategoryValue[] = ["all", ...DISCOVERY_CATEGORIES];
const isCategoryValue = (v: unknown): v is CategoryValue => CATEGORY_OPTIONS.includes(v as CategoryValue);
const COLLAPSED_TILES = 3;

/** Short plural chip labels, as on the dashboard. */
const CHIP_LABEL: Record<DiscoveryCategory, string> = {
  "secret-location": "Secret Locations",
  "loot-route": "Loot Routes",
  "easter-egg": "Easter Eggs",
  "rotation-route": "Rotations",
  "hidden-chest-area": "Hidden Chests",
  "npc-spawn": "NPCs",
  "vehicle-spawn": "Vehicles",
  "competitive-advantage": "Comp Edge",
};

function Tile({ d, now, selected, featured, onSelect }: { d: MapDiscovery; now: number; selected: boolean; featured: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`tile tile--${d.rarity}${selected ? " is-selected" : ""}${featured ? " tile--featured" : ""}${d.status === "archived" ? " tile--archived" : ""}`}
      id={`discovery-${d.id}`}
      aria-pressed={selected}
      aria-controls="discovery-detail"
      onClick={onSelect}
    >
      <span className="tile__art">
        {d.imageUrl ? <img src={d.imageUrl} alt="" loading="lazy" /> : <DiscoveryArt id={d.id} category={d.category} rarity={d.rarity} />}
        <span className="tile__category">{DISCOVERY_CATEGORY_LABEL[d.category]}</span>
        {isNewDiscovery(d, now) && <span className="new-badge">New</span>}
        {d.status === "archived" && <span className="archived-badge">Archived</span>}
        <ChevronRight className="tile__chev" />
      </span>
      <span className="tile__body">
        <span className="tile__title">{d.title}</span>
        <span className="tile__summary">{d.summary}</span>
        <span className="tile__date">
          <span className={`rarity rarity--${d.rarity}`}>
            <span className="rarity__gem" aria-hidden="true" />
            {DISCOVERY_RARITY_LABEL[d.rarity]}
          </span>
          Added {formatSASTShortDate(d.addedAt)}
        </span>
      </span>
    </button>
  );
}

function Detail({ d, season, onClose }: { d: MapDiscovery; season: string; onClose: () => void }) {
  return (
    <div className={`discovery-detail discovery-detail--${d.rarity}`} id="discovery-detail" role="region" aria-label={`${d.title} details`}>
      <div className="discovery-detail__head">
        <div>
          <p className="row__kicker">
            {DISCOVERY_CATEGORY_LABEL[d.category]} · {DISCOVERY_RARITY_LABEL[d.rarity]}
          </p>
          <h3>{d.title}</h3>
        </div>
        <button type="button" className="icon-button" aria-label="Close details" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <p>{d.summary}</p>
      {d.details && <p className="discovery-detail__more">{d.details}</p>}
      {d.status === "archived" && d.archivedReason && (
        <p className="discovery-detail__archived">
          Archived {d.archivedAt ? formatSASTShortDate(d.archivedAt) : ""}: {d.archivedReason}
        </p>
      )}
      <dl className="discovery-detail__facts">
        <div>
          <dt>Map area</dt>
          <dd>{d.mapArea}</dd>
        </div>
        <div>
          <dt>Loot</dt>
          <dd>
            <LootRating value={d.lootRating} />
          </dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>{season}</dd>
        </div>
        <div>
          <dt>Added</dt>
          <dd>{formatSASTShortDate(d.addedAt)}</dd>
        </div>
      </dl>
      <div className="row__footer">
        <ConfidenceBadge confidence={d.confidence} />
        <SourceLink url={d.sourceUrl} />
      </div>
    </div>
  );
}

export function DiscoveriesPanel({ discoveries, seasons, now, focus }: { discoveries: MapDiscovery[]; seasons: Season[]; now: number; focus: FocusRequest | null }) {
  const [category, setCategory] = usePersistentState<CategoryValue>("discovery-category", "all", isCategoryValue);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const active = discoveries.filter((d) => d.status === "active");
  const archivedCount = discoveries.length - active.length;
  const featured = pickFeatured(discoveries);
  const isFiltering = query.trim() !== "" || category !== "all";

  let list = filterDiscoveries(discoveries, { query, category, includeArchived: showArchived });
  if (!isFiltering && featured) list = [featured, ...list.filter((d) => d.id !== featured.id)];
  const visible = expanded || isFiltering ? list : list.slice(0, COLLAPSED_TILES);
  const counts = countByCategory(showArchived ? discoveries : active);
  const options = CATEGORY_OPTIONS.filter((c) => c === "all" || c === category || (counts[c] ?? 0) > 0);
  const selected = discoveries.find((d) => d.id === selectedId) ?? null;

  useFocusTarget("discovery", focus, (id) => {
    const target = discoveries.find((d) => d.id === id);
    setCategory("all");
    setQuery("");
    setExpanded(true);
    if (target?.status === "archived") setShowArchived(true);
    setSelectedId(id);
  });

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setQuery("");
      else setTimeout(() => searchRef.current?.focus(), 0);
      return !open;
    });
  };

  return (
    <Panel
      id="discoveries"
      icon={<MapIcon />}
      title="Map Discoveries"
      meta={
        <>
          <strong>{active.length}</strong> {active.length === 1 ? "Discovery" : "Discoveries"} Logged
        </>
      }
      className="dash-panel--discoveries"
    >
      <div className="panel-tools">
        <ChipFilter
          options={options}
          value={category}
          onChange={setCategory}
          counts={counts}
          label={(c) => (c === "all" ? "All" : CHIP_LABEL[c])}
          ariaLabel="Filter discoveries by category"
          className="segmented--panel"
        />
        <button type="button" className={`icon-button${searchOpen ? " is-active" : ""}`} aria-label="Search discoveries" aria-expanded={searchOpen} onClick={toggleSearch}>
          <SearchIcon />
        </button>
      </div>
      {searchOpen && (
        <label className="search search--panel">
          <span className="sr-only">Search discoveries</span>
          <SearchIcon className="search__icon" />
          <input ref={searchRef} type="search" placeholder="Search secrets, POIs, loot…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      )}
      <p className="sr-only" aria-live="polite">
        {isFiltering ? `${list.length} matching discoveries` : ""}
      </p>

      {visible.length ? (
        <div className="tiles">
          {visible.map((d) => (
            <Tile
              key={d.id}
              d={d}
              now={now}
              featured={!isFiltering && d.id === featured?.id}
              selected={selectedId === d.id}
              onSelect={() => setSelectedId((cur) => (cur === d.id ? null : d.id))}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">{isFiltering ? "No discoveries match that search." : "No discoveries logged yet this season — check back after the first week."}</p>
      )}

      {selected && <Detail d={selected} season={seasonName(seasons, selected.seasonId)} onClose={() => setSelectedId(null)} />}

      <div className="panel-foot">
        {!isFiltering && list.length > COLLAPSED_TILES && (
          <button type="button" className="text-button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show fewer" : `View all ${list.length} discoveries`}
          </button>
        )}
        {archivedCount > 0 && (
          <button type="button" className="text-button" aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide" : "Show"} archived ({archivedCount})
          </button>
        )}
      </div>
    </Panel>
  );
}
