import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StatusTone } from "../utils/status";
import { EPIC_STATUS_PAGE } from "../utils/liveStatus";
import { formatSASTTime, SAST_LABEL } from "../utils/time";
import { BellIcon, ChevronDown, CloseIcon, MenuIcon, SearchIcon } from "./Icons";

const SECTIONS = [
  { id: "updates", label: "Updates" },
  { id: "events", label: "Events" },
  { id: "landing", label: "Landing Spots" },
  { id: "discoveries", label: "Secrets" },
] as const;

const EXTERNAL = [
  { href: EPIC_STATUS_PAGE, label: "Epic status page" },
  { href: "https://www.fortnite.com/competitive", label: "Fortnite Competitive" },
];

interface TopBarProps {
  now: number;
  tone: StatusTone;
  onSearch: () => void;
  onOpenSeasonIntel: () => void;
  onOpenAlerts: () => void;
  /** Alerts are switched on for this device (bell shows as active). */
  alertsOn: boolean;
}

/** Highlights the nav link for whichever section is currently in view. */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)?.closest("section")).filter((el): el is HTMLElement => !!el);
    if (!els.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.querySelector("h2")?.id ?? null);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

export function TopBar({ now, tone, onSearch, onOpenSeasonIntel, onOpenAlerts, alertsOn }: TopBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const active = useActiveSection();

  // close the More dropdown on outside click / Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => !moreRef.current?.contains(e.target as Node) && setMoreOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [menuOpen]);

  const openSeasonIntel = () => {
    setMoreOpen(false);
    setMenuOpen(false);
    onOpenSeasonIntel();
  };

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
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}>
              {s.label}
            </a>
          ))}
          <div className="more" ref={moreRef}>
            <button type="button" className="more__button" aria-expanded={moreOpen} aria-haspopup="true" onClick={() => setMoreOpen((v) => !v)}>
              More <ChevronDown />
            </button>
            {moreOpen && (
              <div className="more__menu">
                <button type="button" onClick={openSeasonIntel}>
                  Season intel &amp; map changes
                </button>
                {EXTERNAL.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setMoreOpen(false)}>
                    {l.label} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>

        <span className="topbar__clock" aria-hidden="true">
          <span className={`dot dot--${tone}`} />
          {formatSASTTime(now)} <small>{SAST_LABEL}</small>
        </span>
        <button type="button" className="icon-button" aria-label="Search the tracker" onClick={onSearch}>
          <SearchIcon />
        </button>
        <button
          type="button"
          className={`icon-button alerts-bell${alertsOn ? " is-active" : ""}`}
          aria-label={alertsOn ? "Alerts are on — alert settings" : "Alert settings"}
          onClick={onOpenAlerts}
        >
          <BellIcon />
          {alertsOn && <span className="alerts-bell__dot" aria-hidden="true" />}
        </button>
        <button type="button" className="icon-button" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="site-menu" onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
      </div>

      {/* Portalled to <body>: the top bar's backdrop-filter would otherwise trap this fixed sheet inside the bar's height. */}
      {menuOpen &&
        createPortal(
          <div className="menu-sheet" role="dialog" aria-modal="true" aria-label="Menu" id="site-menu">
            <button type="button" className="menu-sheet__scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setMenuOpen(false)} />
            <div className="menu-sheet__panel">
              <div className="menu-sheet__head">
                <span className="menu-sheet__title">Menu</span>
                <button type="button" className="icon-button" aria-label="Close menu" onClick={() => setMenuOpen(false)} autoFocus>
                  <CloseIcon />
                </button>
              </div>
              <nav aria-label="All sections">
                {SECTIONS.map((s) => (
                  <a key={s.id} href={`#${s.id}`} onClick={() => setMenuOpen(false)}>
                    {s.label}
                  </a>
                ))}
                <button type="button" onClick={openSeasonIntel}>
                  Season intel &amp; map changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSearch();
                  }}
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenAlerts();
                  }}
                >
                  Alerts
                </button>
              </nav>
              <div className="menu-sheet__external">
                {EXTERNAL.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
