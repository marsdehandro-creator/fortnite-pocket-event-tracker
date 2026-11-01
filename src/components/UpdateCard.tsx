import type { UpdateEvent, UpdateStatus } from "../types/events";
import { formatClock, formatDuration, getElapsedMs, getProgress } from "../utils/countdown";
import { UPDATE_KIND_LABEL, UPDATE_STATUS_LABEL } from "../utils/labels";
import { getUpdateDurationMs, getUpdateEnd, UPDATE_STATUS_TONE } from "../utils/status";
import {
  formatSASTLongDate,
  formatSASTShortDate,
  formatSASTTime,
  formatSASTWhen,
  sastDayKey,
  SAST_LABEL,
} from "../utils/time";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Countdown } from "./Countdown";
import { FactList, type Fact } from "./FactList";
import { ProgressBar } from "./ProgressBar";
import { SourceLink } from "./SourceLink";
import { StatusPill } from "./StatusPill";

interface UpdateCardProps {
  update: UpdateEvent;
  status: UpdateStatus;
  now: number;
}

const sast = (d: Date | string) => `${formatSASTTime(d)} ${SAST_LABEL}`;

export function UpdateCard({ update, status, now }: UpdateCardProps) {
  const tone = UPDATE_STATUS_TONE[status];
  const start = new Date(update.downtimeStartsAt);
  const end = getUpdateEnd(update);
  const confirmedEnd = Boolean(update.actualEndAt);
  const duration = getUpdateDurationMs(update);
  const endsOnOtherDay = sastDayKey(start) !== sastDayKey(end);

  const facts: Fact[] = [
    { label: "Date", value: formatSASTLongDate(start) },
    { label: status === "upcoming" ? "Downtime starts" : "Downtime started", value: sast(start) },
    {
      label: confirmedEnd ? "Servers returned" : "Estimated return",
      value: `${sast(end)}${endsOnOtherDay ? ` · ${formatSASTShortDate(end)}` : ""}`,
    },
    { label: confirmedEnd ? "Total downtime" : "Expected duration", value: formatDuration(duration) },
  ];
  if (update.matchmakingDisabledAt && status === "upcoming") {
    facts.splice(1, 0, { label: "Matchmaking off", value: sast(update.matchmakingDisabledAt) });
  }

  return (
    <article className={`card card--${tone}`} id={`update-${update.id}`} aria-labelledby={`update-${update.id}-title`}>
      <header className="card__header">
        <div>
          <p className="card__kicker">
            {UPDATE_KIND_LABEL[update.kind]}
            {update.version && <span className="version-tag">v{update.version}</span>}
          </p>
          <h3 className="card__title" id={`update-${update.id}-title`}>
            {update.name}
          </h3>
        </div>
        <StatusPill tone={tone} label={UPDATE_STATUS_LABEL[status]} pulse={status === "maintenance"} />
      </header>

      <div className="card__timer">
        {status === "upcoming" && (
          <>
            <p className="timer-label">Downtime begins in</p>
            <Countdown target={start} now={now} label="Downtime begins in" />
          </>
        )}

        {status === "maintenance" && (
          <>
            <div className="timer-split">
              <div>
                <p className="timer-label">Running downtime</p>
                <p className="timer-value timer-value--red">{formatClock(getElapsedMs(start, now))}</p>
              </div>
              <div>
                <p className="timer-label">Estimated return in</p>
                <p className="timer-value">{formatClock(end.getTime() - now)}</p>
              </div>
            </div>
            <ProgressBar value={getProgress(start, end, now)} tone="red" label="Downtime progress against the expected duration" />
            <p className="timer-foot">
              {formatDuration(getElapsedMs(start, now))} of an expected {formatDuration(duration)}
            </p>
          </>
        )}

        {status === "live" && (
          <p className="timer-summary">
            <span className="timer-summary__value">Live since {formatSASTWhen(end, now)}</span> ·{" "}
            {formatDuration(duration)} of downtime
          </p>
        )}

        {status === "completed" && (
          <p className="timer-summary">
            <span className="timer-summary__value">{formatDuration(duration)}</span> of downtime
          </p>
        )}
      </div>

      <FactList facts={facts} />

      {update.notes && <p className="card__notes">{update.notes}</p>}

      <footer className="card__footer">
        <ConfidenceBadge confidence={update.confidence} />
        <SourceLink url={update.sourceUrl} />
      </footer>
    </article>
  );
}
