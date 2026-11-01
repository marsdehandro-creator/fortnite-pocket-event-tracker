import type { TrackerData } from "../types/events";
import { formatSASTDateTime } from "../utils/time";
import { ClockIcon, HeartIcon } from "./Icons";

export function Footer({ data }: { data: TrackerData }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__row">
        <span className="site-footer__brand">
          <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#brand-gradient)" />
            <path d="M16 8v8l5 3" stroke="#05060a" strokeWidth="3" strokeLinecap="round" fill="none" />
          </svg>
          <span>
            Fortnite <span className="site-footer__light">Pocket Event Tracker</span>
          </span>
        </span>
        <span className="site-footer__tagline">Built for the community. By players, for players.</span>
        <span className="site-footer__meta">
          <span>
            <ClockIcon /> SAST (UTC+2)
          </span>
          <span>
            <HeartIcon className="heart" /> Duos hit different.
          </span>
        </span>
      </div>
      <p className="site-footer__legal">
        Data updated {formatSASTDateTime(data.updatedAt)}
        {data.source === "api" ? " · live feed" : ""} · Every card shows how confirmed it is and links its source. Unofficial fan project — not
        affiliated with, endorsed or sponsored by Epic Games. Fortnite is a trademark of Epic Games, Inc.
      </p>
    </footer>
  );
}
