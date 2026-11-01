import type { TrackerData } from "../types/events";
import { formatSASTDateTime } from "../utils/time";

export function Footer({ data }: { data: TrackerData }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="site-footer__brand">Fortnite Pocket Event Tracker</p>
          <p className="site-footer__text">
            All times are South African Standard Time (SAST, UTC+2). Schedules come from Epic Games announcements and
            trusted community reporting — every card shows how confirmed it is and links to its source.
          </p>
        </div>
        <div className="site-footer__meta">
          <p>
            Data updated {formatSASTDateTime(data.updatedAt)}
            {data.source === "api" ? " · live feed" : ""}
          </p>
          <p>
            Official sources:{" "}
            <a href="https://status.epicgames.com/" target="_blank" rel="noopener noreferrer">
              Epic status
            </a>{" "}
            ·{" "}
            <a href="https://www.fortnite.com/competitive" target="_blank" rel="noopener noreferrer">
              Fortnite Competitive
            </a>
          </p>
        </div>
      </div>
      <p className="site-footer__legal">
        © {year} Fortnite Pocket Event Tracker. Unofficial fan project — not affiliated with, endorsed or sponsored by
        Epic Games. Fortnite is a trademark of Epic Games, Inc.
      </p>
    </footer>
  );
}
