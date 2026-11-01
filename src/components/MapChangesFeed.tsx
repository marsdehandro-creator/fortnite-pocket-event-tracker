import { useState } from "react";
import type { MapChange } from "../types/intel";
import { MAP_CHANGE_LABEL } from "../utils/labels";
import { orderMapChanges } from "../utils/poi";
import { formatSASTShortDate } from "../utils/time";
import { SourceLink } from "./SourceLink";

const COLLAPSED_COUNT = 4;

export function MapChangesFeed({ changes, now }: { changes: MapChange[]; now: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!changes.length) return null;

  const ordered = orderMapChanges(changes, now);
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_COUNT);

  return (
    <div className="map-changes">
      <h3 className="map-changes__title">Map changes</h3>
      <ol className="map-changes__list">
        {visible.map(({ change, scheduled }) => (
          <li key={change.id} className={`map-change map-change--${change.type}`}>
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
      {ordered.length > COLLAPSED_COUNT && (
        <button type="button" className="ghost-button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer changes" : `Show all ${ordered.length} changes`}
        </button>
      )}
    </div>
  );
}
