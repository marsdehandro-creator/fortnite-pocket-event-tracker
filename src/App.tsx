import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackgroundArt } from "./components/BackgroundArt";
import { DiscoveriesPanel } from "./components/DiscoveriesPanel";
import { EventsPanel } from "./components/EventsPanel";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { LandingPanel } from "./components/LandingPanel";
import type { FocusKind, FocusRequest } from "./components/Panel";
import { AlertsDialog } from "./components/AlertsDialog";
import { InstallDialog } from "./components/InstallDialog";
import { SearchDialog } from "./components/SearchDialog";
import { SeasonIntel } from "./components/SeasonIntel";
import { StructuredData } from "./components/StructuredData";
import { TopBar } from "./components/TopBar";
import { UpdatesPanel } from "./components/UpdatesPanel";
import { useAlerts } from "./hooks/useAlerts";
import { promptInstall, useInstallMode } from "./pwa/install";
import { useLiveStatus } from "./hooks/useLiveStatus";
import { useNow } from "./hooks/useNow";
import { useTrackerData } from "./hooks/useTrackerData";
import { useTournaments } from "./hooks/useTournaments";
import { getScheduleStatus, type StatusTone } from "./utils/status";

const LIVE_TONE: Record<string, StatusTone> = { online: "green", degraded: "orange", maintenance: "red", down: "red" };

export function App() {
  const now = useNow();
  const { data: baseData } = useTrackerData();
  const tournaments = useTournaments();
  // Tournaments load separately (runtime JSON); everything else reads them from `data.events` as before.
  const data = useMemo(
    () => (tournaments.events.length ? { ...baseData, events: tournaments.events } : baseData),
    [baseData, tournaments.events],
  );
  const live = useLiveStatus();
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const installMode = useInstallMode();
  const install = useCallback(() => {
    if (installMode === "prompt") void promptInstall();
    else if (installMode === "ios") setInstallOpen(true);
  }, [installMode]);
  const alerts = useAlerts(tournaments.events, data.updates);
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

  // A tapped alert opens ./?event=<id>#events (or ?update=<id>): reveal that record once its data has loaded.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current) return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");
    const updateId = params.get("update");
    if (eventId && !tournaments.events.some((e) => e.id === eventId) && tournaments.status === "loading") return;
    deepLinked.current = true;
    if (eventId) requestFocus("event", eventId);
    else if (updateId) requestFocus("update", updateId);
    if (eventId || updateId) {
      params.delete("event");
      params.delete("update");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, [tournaments.events, tournaments.status, requestFocus]);

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
      <TopBar
        now={now}
        tone={tone}
        onSearch={() => setSearchOpen(true)}
        onOpenSeasonIntel={openSeasonIntel}
        onOpenAlerts={() => setAlertsOpen(true)}
        alertsOn={alerts.prefs.enabled && alerts.permission === "granted"}
        canInstall={installMode !== null}
        onInstall={install}
      />
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
          <EventsPanel
            events={data.events}
            now={now}
            focus={focus}
            loading={tournaments.status === "loading"}
            failed={tournaments.status === "error"}
            updatedAt={tournaments.updatedAt}
            log={tournaments.log}
          />
          <DiscoveriesPanel discoveries={data.discoveries} seasons={data.seasons} now={now} focus={focus} />
          <LandingPanel pois={data.pois} mapChanges={data.mapChanges} seasons={data.seasons} now={now} focus={focus} />
        </div>
      </main>
      <Footer data={data} />
      <AlertsDialog open={alertsOpen} onClose={() => setAlertsOpen(false)} alerts={alerts} events={tournaments.events} updates={data.updates} now={now} />
      <InstallDialog open={installOpen} onClose={() => setInstallOpen(false)} />
      <SearchDialog open={searchOpen} data={data} onClose={() => setSearchOpen(false)} onSelect={requestFocus} />
      <StructuredData events={data.events} now={now} />
    </>
  );
}
