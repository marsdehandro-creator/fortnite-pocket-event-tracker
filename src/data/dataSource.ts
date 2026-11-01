import type { TrackerData, TrackerDataSource } from "../types/events";
import { isCompetitiveEvent, isUpdateEvent, sanitizeList } from "../utils/validate";
import updatesFile from "./updates.json";
import eventsFile from "./events.json";

/**
 * Data providers. The bundled JSON is always available (zero network, instant first paint); an HTTP API can be
 * layered on top via VITE_TRACKER_API_URL and falls back to the bundled data on any failure.
 *
 * API contract (both return the same envelope as the JSON files in this folder):
 *   GET {base}/updates → { "updatedAt": ISO, "items": UpdateEvent[] }
 *   GET {base}/events  → { "updatedAt": ISO, "items": CompetitiveEvent[] }
 */

interface Envelope {
  updatedAt?: unknown;
  items?: unknown;
}

const latest = (...isoDates: unknown[]): string => {
  const valid = isoDates.filter((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return valid.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? new Date().toISOString();
};

function fromEnvelopes(updates: Envelope, events: Envelope, source: TrackerData["source"]): TrackerData {
  return {
    updates: sanitizeList(updates.items, isUpdateEvent, `${source} updates`),
    events: sanitizeList(events.items, isCompetitiveEvent, `${source} events`),
    source,
    updatedAt: latest(updates.updatedAt, events.updatedAt),
  };
}

let staticCache: TrackerData | null = null;

/** Synchronous access to the bundled dataset (validated once). */
export function getStaticData(): TrackerData {
  staticCache ??= fromEnvelopes(updatesFile, eventsFile, "static");
  return staticCache;
}

export const staticDataSource: TrackerDataSource = {
  load: async () => getStaticData(),
};

export function createApiDataSource(baseUrl: string, fallback: TrackerDataSource = staticDataSource): TrackerDataSource {
  const base = baseUrl.replace(/\/+$/, "");
  const getJson = async (path: string, signal?: AbortSignal): Promise<Envelope> => {
    const res = await fetch(`${base}/${path}`, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return (await res.json()) as Envelope;
  };

  return {
    async load(signal) {
      try {
        const [updates, events] = await Promise.all([getJson("updates", signal), getJson("events", signal)]);
        const data = fromEnvelopes(updates, events, "api");
        // An API that answers with nothing usable shouldn't blank the page.
        if (!data.updates.length && !data.events.length) throw new Error("API returned no valid records");
        return data;
      } catch (error) {
        if (signal?.aborted) throw error;
        console.warn("[tracker] API unavailable, using bundled data:", error);
        return fallback.load(signal);
      }
    },
  };
}

const apiUrl = import.meta.env.VITE_TRACKER_API_URL?.trim();

/** The provider the app uses: the API when configured, otherwise the bundled JSON. */
export const trackerDataSource: TrackerDataSource = apiUrl ? createApiDataSource(apiUrl) : staticDataSource;
export const hasLiveApi = Boolean(apiUrl);
