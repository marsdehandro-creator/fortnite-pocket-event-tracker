# Fortnite Pocket Event Tracker

Track Fortnite updates, downtime, maintenance windows, tournaments, cups, and competitive events in **South African time (SAST, UTC+2)**.

A mobile-first, single-page live-ops dashboard: live SAST clock, schedule status, update/downtime countdowns with running-downtime timers, and a competitive events hub filterable by Solo / Duos / Trios / Squads.

Unofficial fan project, not affiliated with or endorsed by Epic Games.

## Stack

Vite · React 18 · TypeScript (strict) · Vitest · plain CSS with design tokens. Deployed to GitHub Pages by GitHub Actions (`.github/workflows/pages.yml`: install → test → build → deploy `dist/`).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (time zones, countdowns, status rules, data validation)
npm run build      # type-check + production build into dist/
```

## Project structure

```
src/
  components/   UI: Hero, NextEventCard, UpdateTracker/UpdateCard, EventsTracker/EventCard, FormatFilter, …
  data/         updates.json, events.json (static data) + dataSource.ts (static/API providers)
  hooks/        useNow (shared 1s clock), useTrackerData, usePersistentState
  types/        events.ts — UpdateEvent, CompetitiveEvent, TrackerData, TrackerDataSource
  utils/        time (SAST/zone conversion), countdown, status, validate, labels
  styles/       global.css (tokens + components)
public/         favicon, app icons, OG image, web manifest
docs/           REDESIGN.md — audit, architecture and migration notes
```

## Updating the schedule

Edit `src/data/updates.json` or `src/data/events.json` and push. Rules:

- Timestamps are ISO-8601 **with an explicit offset**, written in SAST: `"2026-11-01T07:00:00+02:00"`. Entries without an offset are rejected.
- Never store a status. Upcoming / Maintenance / Live / Completed (and Upcoming / Active / Finished for events) are computed from the times.
- Set `confidence` honestly: `official` (Epic announced it), `reported` (trusted outlets/dataminers), `estimated` (our estimate). It is shown on every card.
- When servers come back, add `actualEndAt` to the update. It overrides `expectedEndAt`.
- Bump the file's `updatedAt`. It's shown in the footer.

`npm test` validates every record, so a typo fails CI instead of silently dropping a card.

## Live data API (optional)

Set `VITE_TRACKER_API_URL` in `.env` (or as a build variable). The app then fetches `{base}/updates` and `{base}/events`, both returning the same `{ updatedAt, items }` envelope as the JSON files. It re-polls every 5 minutes and falls back to the bundled JSON on any error or invalid response. New providers implement `TrackerDataSource` in `src/types/events.ts`.

## Configuration

`.env` holds public build settings: `VITE_SITE_URL` (canonical/OG URLs, `sitemap.xml`, `robots.txt`) and `VITE_TRACKER_API_URL`.
