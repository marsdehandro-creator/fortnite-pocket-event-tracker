# Redesign & migration notes — Fortnite Pocket Event Tracker

Written 2026-11-01 for the rebuild of the previous single-file checklist site into this tracker.

## 1. Repository audit (before)

| Path | What it was | Outcome |
|---|---|---|
| `index.html` | ~2,000-line single file: inline CSS + JS, collectible checklist (Captured/New views, mastery, achievements, daily roast), Fortnite News feed | **Replaced** by the Vite/React app. Old version stays in git history (last commit `753d458`). |
| `.github/workflows/pages.yml` | Deployed the repo root as-is | **Rewritten**: `npm ci` → `npm test` → `npm run build` → deploy `dist/` |
| `.claude/launch.json` | Local static-server preview config | **Rewritten** for `vite dev` under the new name |
| *(none)* | No README, manifest, package.json, metadata, tests | **Added** |

No external API paths, routes, package names or structured data existed in the old project. The old app's data lived in the visitor's `localStorage` under `fortniteSprite*` keys.

## 2. Everything carrying the old branding

| Item | Old | New | Done by |
|---|---|---|---|
| Browser title, H1, metadata | old checklist name | Fortnite Pocket Event Tracker | ✅ this change |
| Package name | *(none)* | `fortnite-pocket-event-tracker` | ✅ |
| Workflow name | "Deploy to GitHub Pages" | "Deploy Fortnite Pocket Event Tracker" | ✅ |
| Launch config name | old name | `pocket-event-tracker` | ✅ |
| Code identifiers, constants, CSS classes | old domain names | new domain (`UpdateEvent`, `CompetitiveEvent`, …) | ✅ (full rewrite) |
| localStorage prefix | `fortniteSprite*` | `fortnite-pocket-event-tracker:` | ✅ new keys; old keys left untouched |
| **GitHub repository name** | `fortnite-sprite-checklist` | `fortnite-pocket-event-tracker` | ⏳ owner action (Settings → Rename) |
| **Pages URL** | `…github.io/fortnite-sprite-checklist/` | `…github.io/fortnite-pocket-event-tracker/` | follows the repo rename |
| **Local folder** | `OneDrive\Desktop\FortniteSpriteChecklist` | e.g. `FortnitePocketEventTracker` | ⏳ owner action (see §10) |
| Scheduled maintenance tasks | old sync + news tasks | retire / repurpose | ⏳ owner decision (see §10) |

Verified: a production build (`dist/`) and all source files contain zero matches for the old terms.

## 3. Breaking changes

1. **The URL changes when the repo is renamed.** GitHub redirects git remotes and repo web pages, but **not GitHub Pages sites**. The old `…/fortnite-sprite-checklist/` URL will 404. If that matters, keep a tiny repo under the old name with a redirect page.
2. **The old checklist is gone from the live site.** Visitors' saved progress stays in their browser (`localStorage` is not cleared), but nothing reads it any more.
3. **A build step now exists.** Pages must deploy via the Actions workflow (already the setting), and deploys now fail if tests fail. That's intentional.
4. **Both scheduled maintenance tasks are already broken:** they point at the pre-OneDrive path `C:\Users\Dehandro\Desktop\…`, and they edit data structures that no longer exist.
5. **`robots.txt` on a project page is advisory only.** Crawlers read `robots.txt` from the domain root (`marsdehandro-creator.github.io/robots.txt`). Submit `sitemap.xml` in Google Search Console instead.

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
8. ⏳ Owner steps in §10
9. ⏳ Ongoing: keep `events.json`/`updates.json` current (manually, a scheduled task, or an API)

## 10. Migration checklist

- [x] Old app preserved in git history (`753d458`)
- [x] Unshipped local edits from the previous session saved as a patch outside the repo
- [x] New app built, tested and verified locally
- [ ] Rename the GitHub repo to `fortnite-pocket-event-tracker` (Settings → General). If you keep the old name, change `VITE_SITE_URL` in `.env` first.
- [ ] Update the local remote: `git remote set-url origin https://github.com/marsdehandro-creator/fortnite-pocket-event-tracker.git`
- [ ] Push to `master`. Confirm Settings → Pages → Source is "GitHub Actions", then watch the workflow go green.
- [ ] Update the repo description/topics on GitHub to the new name
- [ ] Retire the old sync scheduled task. Repurpose the news task into a weekly `updates.json` / `events.json` refresh with the correct path.
- [ ] Optional: rename the local folder and move it out of OneDrive. OneDrive tries to sync `node_modules/`, which is slow and can lock files mid-install.
- [ ] Optional: submit `sitemap.xml` in Google Search Console
