import { useState } from "react";
import type { DiscoveryCategory, MapDiscovery, Season } from "../types/intel";
import { usePersistentState } from "../hooks/usePersistentState";
import { countByCategory, filterDiscoveries, pickFeatured } from "../utils/discoveries";
import { DISCOVERY_CATEGORY_LABEL } from "../utils/labels";
import { seasonName } from "../utils/seasons";
import { DISCOVERY_CATEGORIES } from "../utils/validateIntel";
import { ChipFilter } from "./ChipFilter";
import { DiscoveryCard } from "./DiscoveryCard";

type CategoryValue = DiscoveryCategory | "all";
const CATEGORY_OPTIONS: CategoryValue[] = ["all", ...DISCOVERY_CATEGORIES];
const isCategoryValue = (v: unknown): v is CategoryValue => CATEGORY_OPTIONS.includes(v as CategoryValue);

interface DiscoveriesPanelProps {
  discoveries: MapDiscovery[];
  seasons: Season[];
  now: number;
}

export function DiscoveriesPanel({ discoveries, seasons, now }: DiscoveriesPanelProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = usePersistentState<CategoryValue>("discovery-category", "all", isCategoryValue);
  const [showArchived, setShowArchived] = useState(false);

  const active = discoveries.filter((d) => d.status === "active");
  const archivedCount = discoveries.length - active.length;
  const featured = pickFeatured(discoveries);
  const isFiltering = query.trim() !== "" || category !== "all";

  const results = filterDiscoveries(discoveries, { query, category, includeArchived: showArchived });
  // While browsing unfiltered, the featured card sits on top instead of repeating in the list.
  const list = !isFiltering && featured ? results.filter((d) => d.id !== featured.id) : results;
  const counts = countByCategory(showArchived ? discoveries : active);
  // Only show categories that have something in them (plus "All" and the current choice).
  const options = CATEGORY_OPTIONS.filter((c) => c === "all" || c === category || (counts[c] ?? 0) > 0);

  return (
    <aside className="discoveries" aria-labelledby="discoveries">
      <header className="discoveries__header">
        <p className="eyebrow">Secrets hub</p>
        <h2 id="discoveries">Map Discoveries</h2>
        <p className="discoveries__count">
          <strong>{active.length}</strong> {active.length === 1 ? "Discovery" : "Discoveries"} Logged
          {archivedCount > 0 && <span> · {archivedCount} archived</span>}
        </p>
      </header>

      <div className="discoveries__controls">
        <label className="search">
          <span className="sr-only">Search discoveries</span>
          <svg viewBox="0 0 20 20" aria-hidden="true" className="search__icon">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Search secrets, POIs, loot…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <ChipFilter
          options={options}
          value={category}
          onChange={setCategory}
          counts={counts}
          label={(c) => (c === "all" ? "All" : DISCOVERY_CATEGORY_LABEL[c])}
          ariaLabel="Filter discoveries by category"
          className="segmented--wrap"
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {isFiltering ? `${results.length} matching discoveries` : ""}
      </p>
      <div className="discoveries__list">
        {!isFiltering && featured && (
          <DiscoveryCard discovery={featured} seasonName={seasonName(seasons, featured.seasonId)} now={now} featured />
        )}
        {list.map((d) => (
          <DiscoveryCard key={d.id} discovery={d} seasonName={seasonName(seasons, d.seasonId)} now={now} />
        ))}
        {!list.length && (isFiltering || !featured) && (
          <p className="empty-state">
            {isFiltering ? "No discoveries match that search." : "No discoveries logged yet this season — check back after the first week."}
          </p>
        )}
      </div>

      {archivedCount > 0 && (
        <button type="button" className="ghost-button" aria-pressed={showArchived} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide" : "Show"} archived ({archivedCount})
        </button>
      )}
    </aside>
  );
}
