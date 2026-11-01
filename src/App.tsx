import { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundArt } from "./components/BackgroundArt";
import { DiscoveriesPanel } from "./components/DiscoveriesPanel";
import { EventsPanel } from "./components/EventsPanel";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { LandingPanel } from "./components/LandingPanel";
import type { FocusKind, FocusRequest } from "./components/Panel";
import { SearchDialog } from "./components/SearchDialog";
import { SeasonIntel } from "./components/SeasonIntel";
import { StructuredData } from "./components/StructuredData";
import { TopBar } from "./components/TopBar";
import { UpdatesPanel } from "./components/UpdatesPanel";
import { useLiveStatus } from "./hooks/useLiveStatus";
import { useNow } from "./hooks/useNow";
import { useTrackerData } from "./hooks/useTrackerData";
import { getScheduleStatus, type StatusTone } from "./utils/status";

const LIVE_TONE: Record<string, StatusTone> = { online: "green", degraded: "orange", maintenance: "red", down: "red" };

export function App() {
  const now = useNow();
  const { data } = useTrackerData();
  const live = useLiveStatus();
  const [searchOpen, setSearchOpen] = useState(false);
  const [seasonIntelOpen, setSeasonIntelOpen] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const focusCounter = useRef(0);

  const tone = live.status ? LIVE_TONE[live.status.level] : getScheduleStatus(data.updates, now).tone;

  const requestFocus = useCallback((kind: FocusKind, id: string) => {
    if (kind === "change") setSeasonIntelOpen(true);
    setFocus({ kind, id, n: ++focusCounter.current });
  }, []);

  const openSeasonIntel = useCallback(() => {
    setSeasonIntelOpen(true);
    setTimeout(() => document.getElementById("season-intel")?.scrollIntoView({ block: "start" }), 30);
  }, []);

  // "/" opens search from anywhere (unless already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <BackgroundArt />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopBar now={now} tone={tone} onSearch={() => setSearchOpen(true)} onOpenSeasonIntel={openSeasonIntel} />
      <main id="main" className="page">
        <Hero
          now={now}
          data={data}
          live={live}
          seasonIntelOpen={seasonIntelOpen}
          onToggleSeasonIntel={() => setSeasonIntelOpen((v) => !v)}
          onFocus={requestFocus}
        />
        {seasonIntelOpen && <SeasonIntel now={now} data={data} focus={focus} />}
        <div className="dash-grid">
          <UpdatesPanel updates={data.updates} now={now} focus={focus} />
          <EventsPanel events={data.events} now={now} focus={focus} />
          <DiscoveriesPanel discoveries={data.discoveries} seasons={data.seasons} now={now} focus={focus} />
          <LandingPanel pois={data.pois} mapChanges={data.mapChanges} seasons={data.seasons} now={now} focus={focus} />
        </div>
      </main>
      <Footer data={data} />
      <SearchDialog open={searchOpen} data={data} onClose={() => setSearchOpen(false)} onSelect={requestFocus} />
      <StructuredData events={data.events} now={now} />
    </>
  );
}
