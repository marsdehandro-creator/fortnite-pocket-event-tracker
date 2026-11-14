# Fortnite Pocket Event Tracker

A Fortnite operations center in **South African time (SAST, UTC+2)**: update downtime, competitive events, the best places to land, map changes and newly discovered secrets, on one page.

A mobile-first, single-page live-ops dashboard. It has:
- four headline cards: live SAST clock, **live Fortnite status** (from Epic's public status page), next event, current season (with expandable season intel and map changes)
- update/downtime rows with countdowns and running-downtime timers
- competitive events filterable by Solo / Duos / Trios / Squads
- **Best Landing Spots**: POI power rankings with sort and filter chips
- **Map Discoveries**: art cards with category filter, search and details
- global search (press `/`) that jumps to any update, cup, POI, discovery or map change
- decorative background artwork on desktop, hidden on mobile

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
  components/   UI: TopBar, Hero (stat cards), SeasonIntel, UpdatesPanel, EventsPanel, LandingPanel, DiscoveriesPanel,
                SearchDialog, Footer, BackgroundArt, Artwork (generated tiles), Icons, shared primitives
  data/         five hand-maintained JSON files + dataSource.ts, tournamentsSource.ts (runtime fetch)
  ingest/       Epic tournament normalisation (epic.ts), merge/dedupe/cancel/archive (merge.ts), sync log (syncLog.ts)
  hooks/        useNow (shared 1s clock), useTrackerData, useTournaments, useLiveStatus (Epic status poll), usePersistentState
  types/        events.ts (updates, cups, TrackerData) · intel.ts (Season, MapDiscovery, POIRanking, MapChange)
  utils/        time (SAST), countdown, status, liveStatus, poi (scoring/ranking), discoveries, seasons, validate*, labels
  styles/       global.css (tokens + primitives) · dashboard.css (layout + components) · art.css (background art)
scripts/        sync-tournaments.ts (sync CLI) · browser/ extractors run inside fortnite.com pages
public/         favicon, app icons, OG image, web manifest · data/ synced tournaments, archive, sync log
docs/           REDESIGN.md — architecture and decisions
```

## Updating the data

Hand-maintained content lives in `src/data/`. Tournaments are the exception: they are synced from Epic every 3 days into `public/data/` (see **Tournament sync** below) and fetched by the site at runtime. Adding a discovery, POI or update never needs a code change: edit the JSON and push. Each file is `{ "updatedAt": "…", "items": [...] }`. Shapes are defined in `src/types/`.

| File | Record | What it drives |
|---|---|---|
| `updates.json` | `UpdateEvent` | Downtime tracker, hero status |
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

The `weekly-pocket-tracker-data-refresh` scheduled task (shown as "Tracker data refresh (every 3 days)") follows these same rules to keep these five files current. It is triggered daily at 11:00 SAST and does a full refresh only when the last successful one is 70+ hours old, so it runs every third day and a failed run retries the next day.

## Tournament sync

Every tournament Epic lists on fortnite.com/competitive is imported automatically. Nothing is hard-coded: the type comes from Epic's own `tournamentType` (e.g. `CashCup` → `cash-cup`), or from the event name when Epic only says "Other". A brand-new kind of event appears with a readable label and lands in the **Other** filter until a filter rule recognises it.

| File | What it holds |
|---|---|
| `public/data/tournaments.json` | Current and recent sessions (one record per session per region) |
| `public/data/tournaments-archive.json` | Sessions that ended more than 45 days ago. History is never deleted |
| `public/data/sync-log.json` | Every sync attempt: time, status, counts (discovered/added/updated/rescheduled/cancelled…), errors |

How a sync runs (normally done by the scheduled task `tournament-sync-every-3-days`):

1. `npm run sync:tournaments -- --check-due` prints DUE (exit 0) once the last *successful* sync is 72h old, else NOT_DUE (exit 10). The task runs daily and stops on NOT_DUE, so a failed run retries the next day.
2. In a real browser, open `https://www.fortnite.com/competitive/schedule?region=<R>&lang=en-US` for each region (EU, ME, NAE, NAW, NAC, BR, ASIA, OCE), run `scripts/browser/extract-schedule.js` and append the returned `GZB64:` line to a capture file.
3. `npm run sync:tournaments -- --groups-needed --input capture.txt` lists event pages whose details (description, Epic type, account level…) aren't stored yet. Open each, run `scripts/browser/extract-event.js` and append its JSON line.
4. `npm run sync:tournaments -- --input capture.txt` merges. Records are matched by Epic's event-window id, so re-syncs update in place and never duplicate. A changed start time is kept in `previousStartsAt` (shown as Rescheduled). An upcoming session that disappears from a region that synced successfully is marked cancelled, and restored if it comes back.
5. If the browser can't be used, `npm run sync:tournaments -- --record-failure "reason"` logs the failed attempt and leaves the data untouched.

fortnite.com is protected against automated clients, so the capture must come from a real browser page, never a script or HTTP client.

## Alerts

The bell in the top bar opens per-device alert settings. Nothing is sent until the viewer turns alerts on and grants notification permission. Every alert is local to the device: no accounts, and no server stores subscriptions.

- **What:** tournament sessions and scheduled updates/downtime, each alerted exactly twice: **2 days** and **2 hours** before the start. Viewers filter tournaments by type, region (default EU + ME) and format. "Other" (mostly daily Ranked Cups) is off by default. Several sessions due at once are batched into one notification. Tapping one opens `./?event=<id>`, which reveals that row.
- **While the site is open** (any tab, even backgrounded): checked every minute, on time.
- **While it's closed:** `src/sw/sw.ts` (bundled to `./sw.js` by the `service-worker` plugin in `vite.config.ts`) uses Periodic Background Sync. It re-reads `data/tournaments.json` and `data/updates.json` and shows anything due. This only works in Chrome/Edge when the site is installed as an app, and the browser decides how often it runs, so alerts can arrive late. Safari/iOS and Firefox only alert while the site is open. On iPhone, the site must be added to the Home Screen first (iOS 16.4+).
- **Calendar export:** "Add to calendar" (per row, or all matching events in the settings) downloads an `.ics` with the same two reminders. It's the dependable option, since the phone's calendar fires them with the browser closed.
- Alert state lives in IndexedDB (`pocket-tracker-alerts`), and the "already sent" keys stop the page and the worker from alerting twice.
- Guaranteed delivery to a closed browser would need real Web Push: a small server holding VAPID keys and subscriptions (for example a free Cloudflare Worker). `planDueAlerts()` in `src/notifications/plan.ts` is the piece such a server would reuse.

## Install as an app (PWA)

The site is an installable Progressive Web App: `public/manifest.webmanifest` (192px, 512px and maskable icons) plus the service worker, which `src/main.tsx` registers on every visit in production builds.

- **Offline:** pages and data are **network-first**, so the cache is only a fallback when offline and tournaments are never stale online. Hashed build files under `assets/` are cache-first, because their names change every release (the newest 60 are kept). The installed app opens offline with the last-seen data. Caching is compiled out on the dev server (`__SW_CACHE__`). Bump `CACHE` in `src/sw/sw.ts` to force-clear everyone's cache.
- **Install button** (`src/pwa/install.ts`): appears in the top bar and menu only while the app isn't installed on that device.
  - **Chrome/Edge/Samsung Internet (Android, desktop):** the browser's `beforeinstallprompt` event triggers the button, and clicking it shows the browser's own install dialog. That event only fires when the site is installable and not installed, so the button disappears once installed (`appinstalled`), when the app is opened from the device, or on later visits. It comes back if the app is uninstalled. Chrome may wait for a tap or ~30 seconds on the page before offering it.
  - **iPhone/iPad:** there is no install API, so the button opens Share → Add to Home Screen steps. Safari can't see the Home Screen app, which keeps separate storage, so "I've added it" hides the button in Safari from then on. Inside the Home Screen app it never shows.
  - **Firefox desktop / desktop Safari:** no button. They have no install API, and installing goes through the browser menu.

## Live data API (optional)

Set `VITE_TRACKER_API_URL` in `.env` (or as a build variable). The app then fetches `{base}/updates`, `/events`, `/seasons`, `/discoveries`, `/pois` and `/map-changes`, each returning the same `{ updatedAt, items }` envelope as the JSON files. It re-polls every 5 minutes and falls back to the bundled JSON on any error or invalid response. New providers implement `TrackerDataSource` in `src/types/events.ts`.

## Configuration

`.env` holds public build settings: `VITE_SITE_URL` (canonical/OG URLs, `sitemap.xml`, `robots.txt`) and `VITE_TRACKER_API_URL`.

## Live Fortnite status

The status card polls `https://status.epicgames.com/api/v2/summary.json` every minute (CORS-enabled, no key) and reads only the **Fortnite** component group: Online / Degraded / Maintenance / Down, plus any active Fortnite incident. If the request fails, the card says so and falls back to the announced schedule. Parsing lives in `src/utils/liveStatus.ts` and is unit-tested.

## Artwork

- **Background art** (`src/components/BackgroundArt.tsx`, `src/styles/art.css`): purely decorative, `aria-hidden`, behind all content (z-index 0). It's confined to the empty side gutters and masked out before the content column. It shows on desktop (≥1280px), at reduced strength on large tablets (1024–1279px), and is hidden below 1024px. Strength is `--art-base` in `art.css`: **0.15 (variant B) is the default**. Preview the others with `?art=a` (10%) or `?art=c` (20%). The figures are original stylised SVG. To use your own licensed renders, put the files in `public/art/` and set `FIGURE_IMAGES` at the top of `BackgroundArt.tsx`; masking, grading and opacity still apply.
- **Card art**: discovery cards and POI rows get generated artwork (`src/components/Artwork.tsx`). Add `"imageUrl"` to any record in `discoveries.json` or `pois.json` (a path under `public/` or an absolute URL) to use a real image instead.
- **Season card**: set `"tagline"` on a season (e.g. "Chapter 7 mini-season") for the subtitle under its name.
