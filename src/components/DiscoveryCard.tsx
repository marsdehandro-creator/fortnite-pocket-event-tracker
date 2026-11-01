import { useId, useState } from "react";
import type { MapDiscovery } from "../types/intel";
import { isNewDiscovery } from "../utils/discoveries";
import { DISCOVERY_CATEGORY_LABEL, DISCOVERY_RARITY_LABEL } from "../utils/labels";
import { formatSASTShortDate } from "../utils/time";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SourceLink } from "./SourceLink";

interface DiscoveryCardProps {
  discovery: MapDiscovery;
  seasonName: string;
  now: number;
  featured?: boolean;
}

export function LootRating({ value }: { value?: number }) {
  if (!value) return <span className="loot-rating loot-rating--none">Unrated</span>;
  return (
    <span className="loot-rating" role="img" aria-label={`Loot rating ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`loot-rating__pip${i <= value ? " is-on" : ""}`} aria-hidden="true" />
      ))}
    </span>
  );
}

export function DiscoveryCard({ discovery: d, seasonName, now, featured = false }: DiscoveryCardProps) {
  const [open, setOpen] = useState(featured);
  const detailsId = useId();
  const archived = d.status === "archived";

  return (
    <article
      className={`discovery discovery--${d.rarity}${featured ? " discovery--featured" : ""}${archived ? " discovery--archived" : ""}`}
      aria-label={d.title}
    >
      <div className="discovery__top">
        <span className="discovery__category">{DISCOVERY_CATEGORY_LABEL[d.category]}</span>
        <span className={`rarity rarity--${d.rarity}`}>
          <span className="rarity__gem" aria-hidden="true" />
          {DISCOVERY_RARITY_LABEL[d.rarity]}
        </span>
        {isNewDiscovery(d, now) && <span className="new-badge">New</span>}
        {archived && <span className="archived-badge">Archived</span>}
      </div>

      {featured && <p className="discovery__featured-label">Featured discovery</p>}
      <h3 className="discovery__title">{d.title}</h3>
      <p className="discovery__summary">{d.summary}</p>

      <dl className="discovery__meta">
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
      </dl>

      <button
        type="button"
        className="discovery__toggle"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide details" : "Show details"}
        <span className="discovery__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="discovery__details" id={detailsId}>
          {d.details && <p>{d.details}</p>}
          {archived && d.archivedReason && (
            <p className="discovery__archived-reason">
              Archived {d.archivedAt ? formatSASTShortDate(d.archivedAt) : ""}: {d.archivedReason}
            </p>
          )}
          <dl className="discovery__facts">
            <div>
              <dt>Season</dt>
              <dd>{seasonName}</dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>{formatSASTShortDate(d.addedAt)}</dd>
            </div>
          </dl>
          <div className="discovery__footer">
            <ConfidenceBadge confidence={d.confidence} />
            <SourceLink url={d.sourceUrl} />
          </div>
        </div>
      )}
    </article>
  );
}
