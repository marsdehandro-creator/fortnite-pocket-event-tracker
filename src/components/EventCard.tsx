import type { CompetitiveEvent, CompetitiveStatus } from "../types/events";
import { formatClock, formatDuration, getProgress } from "../utils/countdown";
import { EVENT_STATUS_LABEL, EVENT_TYPE_LABEL, FORMAT_LABEL, LOCAL_REGIONS, REGION_LABEL } from "../utils/labels";
import { EVENT_STATUS_TONE } from "../utils/status";
import { formatSASTLongDate, formatSASTTime, formatSASTWhen, SAST_LABEL } from "../utils/time";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Countdown } from "./Countdown";
import { FactList, type Fact } from "./FactList";
import { ProgressBar } from "./ProgressBar";
import { SourceLink } from "./SourceLink";
import { StatusPill } from "./StatusPill";

interface EventCardProps {
  event: CompetitiveEvent;
  status: CompetitiveStatus;
  now: number;
}

const NOT_PUBLISHED = "Not published";

export function EventCard({ event, status, now }: EventCardProps) {
  const tone = EVENT_STATUS_TONE[status];
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const req = event.requirements;
  const isLocalRegion = LOCAL_REGIONS.includes(event.region);

  const facts: Fact[] = [
    { label: "Date", value: formatSASTLongDate(start) },
    { label: "Time", value: `${formatSASTTime(start)} – ${formatSASTTime(end)} ${SAST_LABEL}` },
    { label: "Duration", value: formatDuration(end.getTime() - start.getTime()) },
    { label: "Format", value: FORMAT_LABEL[event.format] },
    { label: "Mode", value: event.mode },
  ];
  if (event.prizePool) facts.push({ label: "Prize pool", value: event.prizePool });

  const requirements: Fact[] = [
    { label: "Minimum rank", value: req.minRank ?? NOT_PUBLISHED, muted: !req.minRank },
    {
      label: "Account level",
      value: req.minAccountLevel !== undefined ? `Level ${req.minAccountLevel}+` : NOT_PUBLISHED,
      muted: req.minAccountLevel === undefined,
    },
    {
      label: "Region eligibility",
      value: req.regionEligibility.length ? req.regionEligibility.join(", ") : NOT_PUBLISHED,
      muted: !req.regionEligibility.length,
    },
    {
      label: "2FA",
      value: req.twoFactorRequired === undefined ? NOT_PUBLISHED : req.twoFactorRequired ? "Required" : "Not required",
      muted: req.twoFactorRequired === undefined,
    },
  ];

  return (
    <article className={`card card--${tone}`} id={`event-${event.id}`} aria-labelledby={`event-${event.id}-title`}>
      <header className="card__header">
        <div>
          <p className="card__kicker">
            {EVENT_TYPE_LABEL[event.type]}
            <span className={`region-tag${isLocalRegion ? " region-tag--local" : ""}`} title={REGION_LABEL[event.region]}>
              {event.region}
            </span>
          </p>
          <h3 className="card__title" id={`event-${event.id}-title`}>
            {event.name}
            {event.round && <span className="card__round"> · {event.round}</span>}
          </h3>
        </div>
        <StatusPill tone={tone} label={EVENT_STATUS_LABEL[status]} pulse={status === "active"} />
      </header>

      <div className="card__timer">
        {status === "upcoming" && (
          <>
            <p className="timer-label">Starts in</p>
            <Countdown target={start} now={now} label="Starts in" />
          </>
        )}
        {status === "active" && (
          <>
            <p className="timer-label">Ends in</p>
            <p className="timer-value timer-value--green">{formatClock(end.getTime() - now)}</p>
            <ProgressBar value={getProgress(start, end, now)} tone="green" label="Event progress" />
          </>
        )}
        {status === "finished" && (
          <p className="timer-summary">
            <span className="timer-summary__value">Finished</span> {formatSASTWhen(end, now)}
          </p>
        )}
      </div>

      <FactList facts={facts} />

      <div className="requirements">
        <p className="requirements__title">Registration requirements</p>
        <FactList facts={requirements} className="facts--compact" />
      </div>

      {event.notes && <p className="card__notes">{event.notes}</p>}

      <footer className="card__footer">
        <ConfidenceBadge confidence={event.confidence} />
        <SourceLink url={event.sourceUrl} />
      </footer>
    </article>
  );
}
