import { useEffect, useState } from "react";
import type { TrackerData } from "../types/events";
import { getStaticData, hasLiveApi, trackerDataSource } from "../data/dataSource";

/** How often to re-poll a live API. Not used for the bundled JSON, which only changes on deploy. */
const API_REFRESH_MS = 5 * 60_000;

export interface TrackerDataState {
  data: TrackerData;
  /** True while a live API request is in flight (the bundled data is shown meanwhile). */
  refreshing: boolean;
}

/** Bundled data renders instantly; a configured API replaces it when it responds and is re-polled periodically. */
export function useTrackerData(): TrackerDataState {
  const [state, setState] = useState<TrackerDataState>(() => ({ data: getStaticData(), refreshing: hasLiveApi }));

  useEffect(() => {
    if (!hasLiveApi) return;
    const controller = new AbortController();

    const load = () => {
      setState((s) => ({ ...s, refreshing: true }));
      trackerDataSource
        .load(controller.signal)
        .then((data) => setState({ data, refreshing: false }))
        .catch(() => {
          if (!controller.signal.aborted) setState((s) => ({ ...s, refreshing: false }));
        });
    };

    load();
    const id = setInterval(load, API_REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, []);

  return state;
}
