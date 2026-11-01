import { useEffect, useState } from "react";
import { EPIC_STATUS_URL, parseEpicStatus, type LiveStatus } from "../utils/liveStatus";

const POLL_MS = 60_000;
const TIMEOUT_MS = 8_000;

export interface LiveStatusState {
  status: LiveStatus | null;
  /** True once a request has failed and no fresh status is available. */
  unavailable: boolean;
}

/** Polls Epic's status page every minute (and when the tab becomes visible). Failures keep the last good value. */
export function useLiveStatus(): LiveStatusState {
  const [state, setState] = useState<LiveStatusState>({ status: null, unavailable: false });

  useEffect(() => {
    let cancelled = false;
    let inFlight: AbortController | null = null;

    const load = async () => {
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(EPIC_STATUS_URL, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = parseEpicStatus(await res.json(), Date.now());
        if (!parsed) throw new Error("Unexpected status payload");
        if (!cancelled) setState({ status: parsed, unavailable: false });
      } catch {
        // Keep showing the last good status unless it's stale (older than 5 minutes).
        if (!cancelled)
          setState((s) => ({
            status: s.status && Date.now() - s.status.checkedAt < 5 * POLL_MS ? s.status : null,
            unavailable: true,
          }));
      } finally {
        clearTimeout(timer);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      inFlight?.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return state;
}
