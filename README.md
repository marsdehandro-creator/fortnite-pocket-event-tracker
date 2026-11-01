# Fortnite Pocket Event Tracker

A Fortnite operations center in **South African time (SAST, UTC+2)**: update downtime, competitive events, the best places to land, map changes and newly discovered secrets, on one page.

A mobile-first, single-page live-ops dashboard. It has:
- a live SAST clock, schedule status and a season-intel strip
- update/downtime countdowns with running-downtime timers
- a competitive events hub filterable by Solo / Duos / Trios / Squads
- **Best Landing Spots** POI power rankings with a map-changes feed
- a **Map Discoveries** hub: a sticky right-hand panel on desktop, its own section on mobile

Unofficial fan project, not affiliated with or endorsed by Epic Games.

## Stack

Vite · React 18 · TypeScript (strict) · Vitest · plain CSS with design tokens. Deployed to GitHub Pages by GitHub Actions (`.github/workflows/pages.yml`: install → test → build → deploy `dist/`).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (time zones, countdowns, status, rankings, discoveries, data validation)
npm run build      # type-check + production build into dist/
```

## Project structure

```
src/
  components/   UI: Hero, SeasonPanel, UpdateTracker, EventsTracker, LandingSpots/POICard/MapChangesFeed,
                DiscoveriesPanel/DiscoveryCard, shared primitives (ChipFilter, Countdown, StatusPill, …)
  data/         six JSON data files + dataSource.ts (static/API providers)
  hooks/        useNow (shared 1s clock), useTrackerData, usePersistentState
  types/        events.ts (updates, cups, TrackerData) · intel.ts (Season, MapDiscovery, POIRanking, MapChange)
  utils/        time (SAST), countdown, status, poi (scoring/ranking), discoveries, seasons, validate*, labels
  styles/       global.css (tokens + core) · intel.css (rankings + discoveries)
public/         favicon, app icons, OG image, web manifest
docs/           REDESIGN.md — architecture and decisions
```

## Updating the data

All content lives in `src/data/`. Adding a discovery, POI, cup or update never needs a code change: edit the JSON and push. Each file is `{ "updatedAt": "…", "items": [...] }`. Shapes are defined in `src/types/`.

| File | Record | What it drives |
|---|---|---|
| `updates.json` | `UpdateEvent` | Downtime tracker, hero status |
| `events.json` | `CompetitiveEvent` | Competitive events |
| `seasons.json` | `Season` | Season intel strip; which POIs and changes count as current |
| `discoveries.json` | `MapDiscovery` | Map Discoveries hub |
| `pois.json` | `POIRanking` | Best Landing Spots |
| `map-changes.json` | `MapChange` | Map changes feed + change badges on POI cards |

Rules for every file:

- Timestamps are ISO-8601 **with an explicit offset**, written in SAST: `"2026-11-01T07:00:00+02:00"`. Entries without an offset are rejected.
- Never store anything derivable. Statuses, POI rank and overall score, "New" badges and the featured fallback are all computed.
- Set `confidence` honestly: `official` (Epic announced it), `reported` (trusted outlets/dataminers), `estimated` (our estimate). It's shown on every card. On POIs, `estimated` scores display as **Provisional**.
- `seasonId` / `poiId` must point at existing records. `npm test` checks this along with every field.
- Bump the file's `updatedAt`. The newest one shows in the footer.

Per type:

- **Updates:** when servers come back, add `actualEndAt` (it overrides `expectedEndAt`).
- **Discoveries:** `lootRating` is 1–5, or omit it while unknown. Mark at most one active discovery `"featured": true`. Never delete an obsolete discovery: set `"status": "archived"` with `archivedAt` and `archivedReason`.
- **POIs:** scores are 0–10, and `contestRate` higher = more contested. Scores require a `rationale`. Omit `scores` until there's evidence; the card shows "Awaiting rating". The overall score is computed by `overallScore()` in `src/utils/poi.ts`: loot 30%, competitive 25%, mobility 20%, materials 15%, and 10% for the inverse of contest rate. Locations that leave the map get `"status": "removed"` and are never deleted.
- **Map changes:** `type` is added | removed | buffed | nerfed | reworked | map-update. Future `date`s show as "Scheduled". Give a change a `poiId` to badge that POI's card.

The `weekly-pocket-tracker-data-refresh` scheduled task (Mondays 09:00 SAST) follows these same rules to keep all six files current.

## Live data API (optional)

Set `VITE_TRACKER_API_URL` in `.env` (or as a build variable). The app then fetches `{base}/updates`, `/events`, `/seasons`, `/discoveries`, `/pois` and `/map-changes`, each returning the same `{ updatedAt, items }` envelope as the JSON files. It re-polls every 5 minutes and falls back to the bundled JSON on any error or invalid response. New providers implement `TrackerDataSource` in `src/types/events.ts`.

## Configuration

`.env` holds public build settings: `VITE_SITE_URL` (canonical/OG URLs, `sitemap.xml`, `robots.txt`) and `VITE_TRACKER_API_URL`.
