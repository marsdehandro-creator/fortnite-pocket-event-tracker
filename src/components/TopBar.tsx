import type { StatusTone } from "../utils/status";
import { formatSASTTime, SAST_LABEL } from "../utils/time";

export function TopBar({ now, tone }: { now: number; tone: StatusTone }) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <a className="brand" href="#top" aria-label="Fortnite Pocket Event Tracker — back to top">
          <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#brand-gradient)" />
            <path d="M16 8v8l5 3" stroke="#05060a" strokeWidth="3" strokeLinecap="round" fill="none" />
            <defs>
              <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>
          <span className="brand__name">
            Pocket <span>Event Tracker</span>
          </span>
        </a>
        <nav className="topbar__nav" aria-label="Sections">
          <a href="#updates">Updates</a>
          <a href="#events">Events</a>
        </nav>
        <span className="topbar__clock" aria-hidden="true">
          <span className={`dot dot--${tone}`} />
          {formatSASTTime(now)} <small>{SAST_LABEL}</small>
        </span>
      </div>
    </header>
  );
}
