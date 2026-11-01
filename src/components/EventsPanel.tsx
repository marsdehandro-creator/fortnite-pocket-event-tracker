import { useState } from "react";
import type { CompetitiveEvent, CompetitiveStatus, TeamFormat } from "../types/events";
import { usePersistentState } from "../hooks/usePersistentState";
import { formatClock, formatDuration, getProgress } from "../utils/countdown";
import { EVENT_TYPE_LABEL, FORMAT_LABEL, FORMATS, LOCAL_REGIONS, REGION_LABEL } from "../utils/labels";
import { rankEvents } from "../utils/status";
import { formatSASTLongDate, formatSASTShortDate, formatSASTTime, formatSASTWhen, SAST_LABEL } from "../utils/time";
import { ChipFilter } from "./ChipFilter";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { FactList, type Fact } from "./FactList";
import { ChevronDown, EventEmblem, TrophyIcon } from "./Icons";
import { Panel, useFocusTarget, type FocusRequest } from "./Panel";
import { ProgressBar } from "./ProgressBar";
import { SourceLink } from "./SourceLink";

type FormatValue = TeamFormat | "all";
const FORMAT_OPTIONS: FormatValue[] = ["all", ...FORMATS];
const isFormatValue = (v: unknown): v is FormatValue => FORMAT_OPTIONS.includes(v as FormatValue);
const COLLAPSED_ROWS = 3;
const NOT_PUBLISHED = "Not published";

function EventRow({ event, status, now, open, onToggle }: { event: CompetitiveEvent; status: CompetitiveStatus; now: number; open: boolean; onToggle: () => void }) {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const req = event.requirements;
  const detailId = `event-${event.id}-detail`;

  const pill =
    status === "upcoming"
      ? { text: formatDuration(start.getTime() - now), cls: "upcoming", label: "Starts in" }
      : status === "active"
        ? { text: `Live · ${formatDuration(end.getTime() - now)} left`, cls: "live", label: "" }
        : { text: "Finished", cls: "done", label: "" };

  const facts: Fact[] = [
    { label: "Date", value: formatSASTLongDate(start) },
    { label: "Time", value: `${formatSASTTime(start)} – ${formatSASTTime(end)} ${SAST_LABEL}` },
    { label: "Duration", value: formatDuration(end.getTime() - start.getTime()) },
    { label: "Mode", value: event.mode },
    { label: "Region", value: REGION_LABEL[event.region] },
    ...(event.prizePool ? [{ label: "Prize pool", value: event.prizePool }] : []),
  ];
  const requirements: Fact[] = [
    { label: "Minimum rank", value: req.minRank ?? NOT_PUBLISHED, muted: !req.minRank },
    { label: "Account level", value: req.minAccountLevel !== undefined ? `Level ${req.minAccountLevel}+` : NOT_PUBLISHED, muted: req.minAccountLevel === undefined },
    { label: "Region eligibility", value: req.regionEligibility.join(", ") || NOT_PUBLISHED, muted: !req.regionEligibility.length },
    { label: "2FA", value: req.twoFactorRequired === undefined ? NOT_PUBLISHED : req.twoFactorRequired ? "Required" : "Not required", muted: req.twoFactorRequired === undefined },
  ];

  return (
    <article className={`row row--event row--${status}${open ? " is-open" : ""}`} id={`event-${event.id}`}>
      <button type="button" className="row__main" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <EventEmblem className={`emblem--${event.type}`} />
        <span className="row__titles">
          <span className="row__title">
            {event.name}
            {event.round && <span className="row__round"> · {event.round}</span>}
          </span>
          <span className="row__chips">
            <span className={`format-chip format-chip--${event.format}`}>{FORMAT_LABEL[event.format]}</span>
            <span className={`region-chip${LOCAL_REGIONS.includes(event.region) ? " region-chip--local" : ""}`}>{event.region}</span>
            <span className="row__when">
              {formatSASTShortDate(start)} · {formatSASTTime(start)} – {formatSASTTime(end)} {SAST_LABEL}
            </span>
          </span>
        </span>
        <span className={`time-pill time-pill--${pill.cls}`}>
          {pill.label && <span className="sr-only">{pill.label} </span>}
          {pill.text}
        </span>
        <ChevronDown className="row__chev" />
      </button>
      {open && (
        <div className="row__detail" id={detailId}>
          <p className="row__kicker">{EVENT_TYPE_LABEL[event.type]}</p>
          {status === "active" && (
            <div className="row__progress">
              <ProgressBar value={getProgress(start, end, now)} tone="green" label="Event progress" />
              <span>Ends in {formatClock(end.getTime() - now)}</span>
            </div>
          )}
          {status === "finished" && <p className="row__notes">Finished {formatSASTWhen(end, now)}.</p>}
          <FactList facts={facts} />
          <div className="requirements">
            <p className="requirements__title">Registration requirements</p>
            <FactList facts={requirements} className="facts--compact" />
          </div>
          {event.notes && <p className="row__notes">{event.notes}</p>}
          <div className="row__footer">
            <ConfidenceBadge confidence={event.confidence} />
            <SourceLink url={event.sourceUrl} />
          </div>
        </div>
      )}
    </article>
  );
}

export function EventsPanel({ events, now, focus }: { events: CompetitiveEvent[]; now: number; focus: FocusRequest | null }) {
  const [format, setFormat] = usePersistentState<FormatValue>("format-filter", "all", isFormatValue);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const ranked = rankEvents(events, now);
  const counts = { all: ranked.length } as Record<FormatValue, number>;
  FORMATS.forEach((f) => (counts[f] = ranked.filter((r) => r.event.format === f).length));

  const filtered = format === "all" ? ranked : ranked.filter((r) => r.event.format === format);
  // Finished events only show in the expanded view.
  const pool = expanded ? filtered : filtered.filter((r) => r.status !== "finished");
  const visible = expanded ? pool : pool.slice(0, COLLAPSED_ROWS);
  const hiddenCount = filtered.length - visible.length;

  useFocusTarget("event", focus, (id) => {
    setFormat("all");
    setExpanded(true);
    setOpenId(id);
  });

  return (
    <Panel
      id="events"
      icon={<TrophyIcon />}
      title="Upcoming Competitive Events"
      expandLabel={hiddenCount > 0 || expanded ? "View all events" : undefined}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
    >
      <ChipFilter
        options={FORMAT_OPTIONS}
        value={format}
        onChange={setFormat}
        counts={counts}
        label={(o) => (o === "all" ? "All" : FORMAT_LABEL[o])}
        ariaLabel="Filter events by team format"
        className="segmented--panel"
      />
      {visible.length ? (
        <div className="rows">
          {visible.map(({ event, status }) => (
            <EventRow
              key={event.id}
              event={event}
              status={status}
              now={now}
              open={openId === event.id}
              onToggle={() => setOpenId((cur) => (cur === event.id ? null : event.id))}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">
          No upcoming {format === "all" ? "" : `${FORMAT_LABEL[format].toLowerCase()} `}events listed yet. Epic usually publishes the next
          schedule a few days ahead.
        </p>
      )}
      <p className="panel-note">South African players usually queue on EU or ME — those regions are highlighted.</p>
    </Panel>
  );
}
