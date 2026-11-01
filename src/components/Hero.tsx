import type { TrackerData } from "../types/events";
import { formatDuration, getCountdown } from "../utils/countdown";
import { getLiveUpdateId, getScheduleStatus, getUpdateEnd } from "../utils/status";
import { formatSASTLongDate, formatSASTTime, formatSASTWhen, SAST_LABEL } from "../utils/time";
import { NextEventCard } from "./NextEventCard";
import { SeasonPanel } from "./SeasonPanel";
import { StatusPill } from "./StatusPill";

interface HeroProps {
  now: number;
  data: TrackerData;
}

/** How long after servers return the hero keeps saying "back since …". */
const JUST_BACK_MS = 24 * 3_600_000;

export function Hero({ now, data }: HeroProps) {
  const { updates, events } = data;
  const schedule = getScheduleStatus(updates, now);

  let detail: string;
  if (schedule.level === "down" && schedule.update) {
    const end = getUpdateEnd(schedule.update);
    detail = `${schedule.update.name} — estimated return ${formatSASTTime(end)} ${SAST_LABEL} (in ${formatDuration(getCountdown(end, now).totalMs)}).`;
  } else if (schedule.level === "scheduled" && schedule.update) {
    const start = schedule.update.downtimeStartsAt;
    detail = `${schedule.update.version ? `v${schedule.update.version}` : schedule.update.name} downtime starts ${formatSASTWhen(start, now)} (in ${formatDuration(getCountdown(start, now).totalMs)}).`;
  } else {
    const live = updates.find((u) => u.id === getLiveUpdateId(updates, now));
    const end = live && getUpdateEnd(live);
    detail =
      live && end && now - end.getTime() < JUST_BACK_MS
        ? `${live.version ? `v${live.version}` : live.name} is live — servers back since ${formatSASTWhen(end, now)}. No further downtime announced for 48 hours.`
        : "No downtime announced for the next 48 hours.";
  }

  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero__intro">
        <p className="eyebrow">Live ops · South African time</p>
        <h1 id="hero-title">
          Fortnite <span className="text-gradient">Pocket Event Tracker</span>
        </h1>
        <p className="hero__subtitle">
          Track Fortnite updates, downtime, maintenance windows, tournaments, cups, and competitive events in South
          African time.
        </p>
      </div>

      <div className="hero__grid">
        <article className="panel clock-panel" aria-label="Current South African time">
          <p className="panel__label">Current time · {SAST_LABEL}</p>
          <p className="clock">
            <time dateTime={new Date(now).toISOString()}>{formatSASTTime(now, { seconds: true })}</time>
          </p>
          <p className="clock__date">{formatSASTLongDate(now)}</p>
          <p className="clock__zone">Africa/Johannesburg · UTC+2</p>
        </article>

        <article className={`panel status-panel status-panel--${schedule.tone}`}>
          <p className="panel__label">Server schedule</p>
          <StatusPill tone={schedule.tone} label={schedule.label} pulse={schedule.level !== "clear"} size="md" />
          <p className="status-panel__detail">{detail}</p>
          <p className="status-panel__note">Based on announced schedules, not a live server check.</p>
        </article>

        <NextEventCard now={now} updates={updates} events={events} />

        <SeasonPanel now={now} seasons={data.seasons} pois={data.pois} discoveries={data.discoveries} />
      </div>
    </section>
  );
}
