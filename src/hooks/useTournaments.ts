import { useEffect, useState } from "react";
import { loadTournaments, type TournamentData } from "../data/tournamentsSource";

/** Re-check for a newer data deploy when the tab regains focus after this long. */
const REFRESH_AFTER_MS = 30 * 60_000;

export interface TournamentsState extends TournamentData {
  status: "loading" | "ready" | "error";
}

export function useTournaments(): TournamentsState {
  const [state, setState] = useState<TournamentsState>({ status: "loading", events: [], updatedAt: null, log: null });

  useEffect(() => {
    let lastLoad = 0;
    let controller: AbortController | null = null;

    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const c = controller;
      lastLoad = Date.now();
      loadTournaments(c.signal)
        .then((data) => setState({ status: "ready", ...data }))
        .catch(() => {
          // keep whatever we already showed; only flag an error if we have nothing
          if (!c.signal.aborted) setState((s) => (s.status === "ready" ? s : { ...s, status: "error" }));
        });
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad > REFRESH_AFTER_MS) load();
    };

    load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return state;
}
