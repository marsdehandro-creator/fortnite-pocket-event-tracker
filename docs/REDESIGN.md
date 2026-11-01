# Redesign & migration notes — Fortnite Pocket Event Tracker

Written 2026-11-01, when the repository's previous single-file site was rebuilt from scratch as this tracker. The migration is complete. This file records the architecture and the decisions behind it.

## 1. What was replaced

| Path | Before | Now |
|---|---|---|
| `index.html` | ~2,000-line single file with inline CSS + JS (a different product) | Vite entry point + SEO shell. The previous site exists only in git history. |
| `.github/workflows/pages.yml` | Deployed the repo root as-is | `npm ci` → `npm test` → `npm run build` → deploy `dist/` |
| `.claude/launch.json` | Static-server preview | `vite dev` (`pocket-event-tracker`) |
| *(none)* | No README, manifest, package.json, metadata or tests | Added |

## 2. Rebrand scope (all done)

Browser title, H1 and metadata · package name (`fortnite-pocket-event-tracker`) · workflow and launch-config names · every code identifier, constant and CSS class (full rewrite) · localStorage prefix (`fortnite-pocket-event-tracker:`) · GitHub repository name and description · GitHub Pages URL · local folder (now `C:\Users\Dehandro\FortnitePocketEventTracker`, outside OneDrive) · scheduled maintenance tasks (the old ones are deleted; one new weekly data-refresh task exists, see §11).

## 3. Consequences of the rebuild

1. **GitHub Pages doesn't redirect after a repo rename.** The previous site URL returns 404; only git remotes and repo web pages redirect.
2. **Visitors' saved data from the previous site** stays in their browser (`localStorage` was not cleared), but nothing reads it.
3. **A build step now exists.** Pages deploys through the Actions workflow, and a deploy fails if tests fail. That's intentional.
4. **`robots.txt` on a project page is advisory only.** Crawlers read `robots.txt` from the domain root (`marsdehandro-creator.github.io/robots.txt`). Submit `sitemap.xml` in Google Search Console instead.

## 4. Project structure

```
index.html                 SEO shell: meta, Open Graph, Twitter card, JSON-LD (WebSite + WebApplication)
vite.config.ts             base "./" (works at any Pages path) + robots/sitemap generator
.env                       VITE_SITE_URL, VITE_TRACKER_API_URL
public/                    favicon.svg, icon-512.png, apple-touch-icon.png, og-image.png, manifest.webmanifest
src/
  main.tsx, App.tsx
  types/events.ts          all data contracts
  data/                    updates.json, events.json, dataSource.ts (+ data.test.ts)
  hooks/                   useNow, useTrackerData, usePersistentState
  utils/                   time, countdown, status, validate, labels (+ tests)
  components/              see §6
  styles/global.css
```

## 5. Design strategy

- **Positioning:** a live-ops status center and tournament hub. Fortnite-adjacent energy (violet → cyan gradient, angular display type *Chakra Petch*) without Epic's own visual identity.
- **Dark by default.** Near-black canvas with two soft ambient glows, layered surfaces, hairline borders.
- **One colour language for state:** green = live, orange = scheduled, red = down, grey = past. Used on pills, card edges, the headline indicator and the top-bar dot.
- **Time is the hero.** Tabular numerals everywhere a number ticks. One shared 1-second clock drives every timer.
- **Honesty built in.** Every card shows *Official / Reported / Estimated* and links its source. The headline status says it is schedule-based, not a server ping. Unknown requirements show "Not published" instead of a guess.
- **Mobile-first:** single column at 375px, 2 columns from 768px, 3 from 1080px. Sticky top bar with section jumps and a mini SAST clock. Horizontally scrollable format filter. 40px+ tap targets.
- **Performance:** ~55 KB gzipped JS, ~4 KB CSS, data bundled (no request needed to first paint), fonts loaded with `display=swap`. Motion respects `prefers-reduced-motion`.

## 6. UI wireframe and component architecture

```
┌ TopBar ───────────────────────────────────────────── [Updates] [Events] (● 02:10 SAST) ┐
│ Hero                                                                                    │
│   eyebrow · H1 "Fortnite Pocket Event Tracker" · subtitle                               │
│   ┌ Clock panel ──────┐ ┌ Server schedule ───────┐ ┌ NextEventCard ─────────────────┐  │
│   │ 02:10:41          │ │ ● Downtime scheduled   │ │ NEXT DOWNTIME                   │  │
│   │ Sunday 1 Nov 2026 │ │ v43.00 starts today at │ │ v43.00 · Treasure Hunters       │  │
│   │ UTC+2             │ │ 07:00 SAST (in 4h 49m) │ │ [04h][49m][19s]  View details → │  │
│   └───────────────────┘ └────────────────────────┘ └─────────────────────────────────┘  │
│ UpdateTracker      legend: ● Live ● Scheduled ● Down                                    │
│   [UpdateCard: kicker+version · title · pill │ timer block │ facts │ notes │ source]  … │
│   [Show past updates (n)]                                                              │
│ EventsTracker      [All 4][Solo 4][Duos 0][Trios 0][Squads 0]                           │
│   [EventCard: type+region · title+round · pill │ countdown │ facts │ requirements │ …] │
│   [Show finished events (n)]                                                           │
│ Footer — SAST note · data updated · official sources · not-affiliated disclaimer       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Timer block by status. **Upcoming:** "Downtime begins in" countdown. **Maintenance:** running downtime + estimated return in, a progress bar, and "2h 36m of an expected 3h". **Live:** "Live since …". **Completed:** total downtime.

```
App
├─ TopBar
├─ Hero ─ StatusPill, NextEventCard ─ Countdown
├─ UpdateTracker ─ SectionHeader, UpdateCard ─ StatusPill, Countdown, ProgressBar, FactList, ConfidenceBadge, SourceLink
├─ EventsTracker ─ SectionHeader, FormatFilter, EventCard ─ (same primitives)
├─ Footer
└─ StructuredData (schema.org Event JSON-LD for upcoming/active events)
```

Components are presentational. All rules (status, ordering, next item) are pure functions in `utils/status.ts`, unit-tested and reusable by a future API or bot.

## 7. TypeScript interfaces

Defined in [`src/types/events.ts`](../src/types/events.ts):

- `UpdateEvent`: `id, name, version | null, kind, matchmakingDisabledAt?, downtimeStartsAt, expectedEndAt, actualEndAt?, confidence, notes?, sourceUrl?`
- `CompetitiveEvent`: `id, name, type, region, mode, format, round?, startsAt, endsAt, requirements { minRank?, minAccountLevel?, regionEligibility[], twoFactorRequired? }, confidence, prizePool?, notes?, sourceUrl?`
- `UpdateStatus = upcoming | maintenance | live | completed`, `CompetitiveStatus = upcoming | active | finished` (derived, never stored)
- `TrackerData`, `TrackerDataSource { load(signal?) }` (the seam for future APIs)

## 8. Sample data models

```json
{
  "id": "v43-00-treasure-hunters",
  "name": "Treasure Hunters mini-season",
  "version": "43.00",
  "kind": "season-launch",
  "matchmakingDisabledAt": "2026-11-01T06:30:00+02:00",
  "downtimeStartsAt": "2026-11-01T07:00:00+02:00",
  "expectedEndAt": "2026-11-01T10:00:00+02:00",
  "confidence": "official",
  "sourceUrl": "https://status.epicgames.com/"
}
```

```json
{
  "id": "victory-cash-cup-eu-duos-2026-11-12",
  "name": "Victory Cash Cup",
  "type": "victory-cup",
  "region": "EU",
  "mode": "Zero Build",
  "format": "duos",
  "startsAt": "2026-11-12T19:00:00+02:00",
  "endsAt": "2026-11-12T22:00:00+02:00",
  "requirements": { "minRank": "Platinum I", "minAccountLevel": 50, "regionEligibility": ["EU"], "twoFactorRequired": true },
  "confidence": "official",
  "sourceUrl": "https://www.fortnite.com/competitive"
}
```

The second example is **illustrative only**, to show the shape. It is not in the live data.

**Seed data status (1 Nov 2026):** the updates are real (v43.00 downtime per Epic's status page, EOS maintenance on 10 Nov, two past season launches). Competitive data is thin. The only public listings found were NAC FNCS Solos Reload qualifier dates (4, 5, 8 and 9 Nov) with an unstated timezone, so those cards are marked **Estimated**. No EU/ME events are listed yet, and none were invented.

## 9. Implementation plan

1. ✅ Vite + React + TS scaffold with strict typing, relative base path, env-driven site URL
2. ✅ Types → utils (time, countdown, status, validation) → unit tests (30 passing)
3. ✅ Data layer: validated static JSON + API provider with fallback
4. ✅ Components + design system, mobile-first
5. ✅ SEO: meta, OG/Twitter with a generated 1200×630 card, JSON-LD (site + events), sitemap, manifest, icons
6. ✅ CI: test-gated Pages deploy
7. ✅ Browser verification: desktop + 375px mobile, upcoming and simulated maintenance states, filter, persistence, toggles, zero console errors
8. ✅ Repository renamed, deployed via the test-gated workflow, verified live
9. ✅ Weekly automated data refresh (see §11)

## 10. Migration steps (complete)

- [x] New app built, tested and verified locally and live
- [x] GitHub repo renamed, description and homepage updated, local remote repointed
- [x] Pushed to `master`; Pages deploys from GitHub Actions
- [x] Old scheduled maintenance tasks deleted
- [x] Project moved out of OneDrive to `C:\Users\Dehandro\FortnitePocketEventTracker`
- [ ] Optional: submit `sitemap.xml` in Google Search Console

## 11. Keeping the data fresh

A Claude Code scheduled task, **`weekly-pocket-tracker-data-refresh`** (Mondays 09:00 SAST), researches Epic's announced downtime and the competitive schedule. It updates `src/data/updates.json` / `events.json` under the rules in the README, runs `npm test` and `npm run build`, and commits/pushes only if both pass. Every run ends with a report of what changed and what it couldn't confirm.

Manual edits are always fine between runs. The task merges with what's there and never deletes records that are still upcoming.
