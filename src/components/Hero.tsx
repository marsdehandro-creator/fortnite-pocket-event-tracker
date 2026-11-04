import type { LiveStatusState } from "../hooks/useLiveStatus";
import type { TrackerData } from "../types/events";
import { getCountdown } from "../utils/countdown";
import { eventTypeLabel, FORMAT_LABEL, LOCAL_REGIONS } from "../utils/labels";
import { EPIC_STATUS_PAGE } from "../utils/liveStatus";
import { getCurrentSeason } from "../utils/seasons";
import { getNextItem, getScheduleStatus } from "../utils/status";
import { formatSASTLongDate, formatSASTShortDate, formatSASTTime, SAST_LABEL } from "../utils/time";
import { ArrowRight, ClockIcon, PulseIcon, ShieldIcon, TrophyIcon } from "./Icons";
import type { FocusKind } from "./Panel";

interface HeroProps {
  now: number;
  data: TrackerData;
  live: LiveStatusState;
  seasonIntelOpen: boolean;
  onToggleSeasonIntel: () => void;
  onFocus: (kind: FocusKind, id: string) => void;
}

const LIVE_TONE = { online: "green", degraded: "orange", maintenance: "red", down: "red" } as const;

function TimeCard({ now }: { now: number }) {
  return (
    <article className="stat-card" aria-label="Current South African time">
      <p className="stat-card__label">Current time · {SAST_LABEL}</p>
      <div className="stat-card__body">
        <ClockIcon className="stat-card__icon stat-card__icon--cyan" />
        <div>
          <p className="stat-card__clock">
            <time dateTime={new Date(now).toISOString()}>{formatSASTTime(now, { seconds: true })}</time>
          </p>
          <p className="stat-card__sub">{formatSASTLongDate(now)}</p>
          <p className="stat-card__fine">Johannesburg · UTC+2</p>
        </div>
      </div>
    </article>
  );
}

function StatusCard({ now, data, live }: { now: number; data: TrackerData; live: LiveStatusState }) {
  const schedule = getScheduleStatus(data.updates, now);
  const s = live.status;
  const tone = s ? LIVE_TONE[s.level] : schedule.tone;
  const headline = s ? s.label : schedule.level === "down" ? "Maintenance" : "Status";
  const detail = s ? s.detail : schedule.label;
  const upcoming = schedule.level === "scheduled" && schedule.update;

  return (
    <article className={`stat-card stat-card--status stat-card--${tone}`}>
      <p className="sr-only" aria-live="polite">
        Fortnite status: {headline}. {detail}
      </p>
      <p className="stat-card__label">Fortnite status</p>
      <div className="stat-card__body">
        <span className={`big-dot big-dot--${tone}`} aria-hidden="true" />
        <p className="stat-card__headline">{headline}</p>
      </div>
      <p className="stat-card__sub stat-card__sub--pulse">
        <PulseIcon className={`pulse-icon pulse-icon--${tone}`} />
        {detail}
      </p>
      {s?.incident && (
        <p className="stat-card__fine">
          Incident:{" "}
          <a href={s.incident.url ?? EPIC_STATUS_PAGE} target="_blank" rel="noopener noreferrer">
            {s.incident.name}
          </a>
        </p>
      )}
      {upcoming && (
        <p className="stat-card__fine">
          Next downtime {formatSASTShortDate(upcoming.downtimeStartsAt)} · {formatSASTTime(upcoming.downtimeStartsAt)} {SAST_LABEL}
        </p>
      )}
      <p className="stat-card__source">
        {s ? (
          <>
            Live from{" "}
            <a href={EPIC_STATUS_PAGE} target="_blank" rel="noopener noreferrer">
              Epic status
            </a>{" "}
            · {formatSASTTime(s.checkedAt)}
          </>
        ) : live.unavailable ? (
          "Live status unavailable — showing announced schedule"
        ) : (
          "Checking Epic status…"
        )}
      </p>
    </article>
  );
}

function NextCard({ now, data, onFocus }: { now: number; data: TrackerData; onFocus: HeroProps["onFocus"] }) {
  // South African players queue on EU/ME, so those regions' events lead; any region is the fallback.
  const localEvents = data.events.filter((e) => LOCAL_REGIONS.includes(e.region));
  const next = getNextItem(data.updates, localEvents, now) ?? getNextItem(data.updates, data.events, now);
  if (!next) {
    return (
      <article className="stat-card">
        <p className="stat-card__label">Next event</p>
        <p className="stat-card__sub">Nothing scheduled yet — check back soon.</p>
      </article>
    );
  }
  const isUpdate = next.kind === "update";
  const title = isUpdate ? `${next.item.version ? `v${next.item.version} ` : ""}${next.item.name}` : next.item.name;
  const meta = isUpdate
    ? "Downtime"
    : [eventTypeLabel(next.item.type), next.item.format && FORMAT_LABEL[next.item.format], next.item.region].filter(Boolean).join(" · ");
  const c = getCountdown(next.at, now);
  const tiles: [number, string][] = c.days ? [[c.days, "d"], [c.hours, "h"], [c.minutes, "m"]] : [[c.hours, "h"], [c.minutes, "m"], [c.seconds, "s"]];
  const label = next.inProgress ? (isUpdate ? "Happening now · back in" : "Live now · ends in") : isUpdate ? "Next downtime" : "Next event";

  return (
    <article className="stat-card stat-card--next">
      <p className="stat-card__label">{label}</p>
      <button type="button" className="stat-card__body stat-card__link" onClick={() => onFocus(isUpdate ? "update" : "event", next.item.id)}>
        <TrophyIcon className="stat-card__icon stat-card__icon--gold" />
        <span>
          <span className="stat-card__title">{title}</span>
          <span className="stat-card__sub">
            {formatSASTShortDate(next.at)} · {formatSASTTime(next.at)} {SAST_LABEL}
            <span className="sr-only"> · {meta}</span>
          </span>
        </span>
      </button>
      <div className="mini-countdown" role="timer" aria-label={`${label} ${tiles.map(([v, u]) => `${v}${u}`).join(" ")}`}>
        {tiles.map(([v, u]) => (
          <span key={u} className="mini-countdown__unit" aria-hidden="true">
            <span className="mini-countdown__value">{String(v).padStart(2, "0")}</span>
            <span className="mini-countdown__label">{u}</span>
          </span>
        ))}
      </div>
    </article>
  );
}

function SeasonCard({ now, data, open, onToggle }: { now: number; data: TrackerData; open: boolean; onToggle: () => void }) {
  const season = getCurrentSeason(data.seasons, now);
  return (
    <article className="stat-card stat-card--season">
      <p className="stat-card__label">Current season</p>
      <div className="stat-card__body">
        <ShieldIcon className="stat-card__icon stat-card__icon--violet" />
        <div>
          <p className="stat-card__title stat-card__title--lg">{season ? season.name : "Between seasons"}</p>
          <p className="stat-card__sub">{season ? (season.tagline ?? season.mapName) : "Servers are switching islands"}</p>
        </div>
      </div>
      <button type="button" className="outline-button" aria-expanded={open} aria-controls="season-intel" onClick={onToggle}>
        {open ? "Hide season intel" : "View season intel"}
        <ArrowRight className={open ? "is-flipped" : ""} />
      </button>
    </article>
  );
}

export function Hero({ now, data, live, seasonIntelOpen, onToggleSeasonIntel, onFocus }: HeroProps) {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero__intro">
        <p className="eyebrow">Live ops · South African time</p>
        <h1 id="hero-title">
          Fortnite <span className="text-gradient">Pocket Event Tracker</span>
        </h1>
        <p className="hero__subtitle">
          Track Fortnite updates, downtime, tournaments, cups, map changes, hidden secrets, and the best landing spots — all in South African
          time.
        </p>
      </div>
      <div className="stat-grid">
        <TimeCard now={now} />
        <StatusCard now={now} data={data} live={live} />
        <NextCard now={now} data={data} onFocus={onFocus} />
        <SeasonCard now={now} data={data} open={seasonIntelOpen} onToggle={onToggleSeasonIntel} />
      </div>
    </section>
  );
}
