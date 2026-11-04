import type { TrackerData, TrackerDataSource } from "../types/events";
import { isCompetitiveEvent, isUpdateEvent, sanitizeList } from "../utils/validate";
import { findBrokenReferences, isMapChange, isMapDiscovery, isPOIRanking, isSeason } from "../utils/validateIntel";
import updatesFile from "./updates.json";
import seasonsFile from "./seasons.json";
import discoveriesFile from "./discoveries.json";
import poisFile from "./pois.json";
import mapChangesFile from "./map-changes.json";

/**
 * Data providers. The bundled JSON is always available (zero network, instant first paint); an HTTP API can be
 * layered on top via VITE_TRACKER_API_URL and falls back to the bundled data on any failure.
 *
 * API contract — every endpoint returns the same envelope as the matching JSON file in this folder,
 * { "updatedAt": ISO, "items": [...] }:
 *   GET {base}/updates      → UpdateEvent[]
 *   GET {base}/events       → CompetitiveEvent[]
 *   GET {base}/seasons      → Season[]
 *   GET {base}/discoveries  → MapDiscovery[]
 *   GET {base}/pois         → POIRanking[]
 *   GET {base}/map-changes  → MapChange[]
 */

interface Envelope {
  updatedAt?: unknown;
  items?: unknown;
}

const ENDPOINTS = ["updates", "events", "seasons", "discoveries", "pois", "map-changes"] as const;
type Endpoint = (typeof ENDPOINTS)[number];
type Envelopes = Record<Endpoint, Envelope>;

const latest = (...isoDates: unknown[]): string => {
  const valid = isoDates.filter((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return valid.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? new Date().toISOString();
};

function fromEnvelopes(e: Envelopes, source: TrackerData["source"]): TrackerData {
  const data: TrackerData = {
    updates: sanitizeList(e.updates.items, isUpdateEvent, `${source} updates`),
    events: sanitizeList(e.events.items, isCompetitiveEvent, `${source} events`),
    seasons: sanitizeList(e.seasons.items, isSeason, `${source} seasons`),
    discoveries: sanitizeList(e.discoveries.items, isMapDiscovery, `${source} discoveries`),
    pois: sanitizeList(e.pois.items, isPOIRanking, `${source} pois`),
    mapChanges: sanitizeList(e["map-changes"].items, isMapChange, `${source} map changes`),
    source,
    updatedAt: latest(...ENDPOINTS.map((k) => e[k].updatedAt)),
  };
  // Broken links degrade gracefully in the UI (unknown names fall back to ids), so warn rather than drop.
  findBrokenReferences(data).forEach((p) => console.warn(`[tracker] ${source} data: ${p}`));
  return data;
}

let staticCache: TrackerData | null = null;

/** Synchronous access to the bundled dataset (validated once). */
export function getStaticData(): TrackerData {
  staticCache ??= fromEnvelopes(
    {
      updates: updatesFile,
      // Tournaments are not bundled: they live in public/data/ and load at runtime (useTournaments).
      events: { items: [] },
      seasons: seasonsFile,
      discoveries: discoveriesFile,
      pois: poisFile,
      "map-changes": mapChangesFile,
    },
    "static",
  );
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
        const bodies = await Promise.all(ENDPOINTS.map((p) => getJson(p, signal)));
        const data = fromEnvelopes(Object.fromEntries(ENDPOINTS.map((p, i) => [p, bodies[i]])) as Envelopes, "api");
        // An API that answers with nothing usable shouldn't blank the page.
        if (!data.updates.length && !data.events.length && !data.pois.length) throw new Error("API returned no valid records");
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
