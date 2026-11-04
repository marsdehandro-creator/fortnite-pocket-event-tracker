import { useMemo, useState } from "react";
import type { CompetitiveEvent, CompetitiveStatus, SyncLog, TeamFormat } from "../types/events";
import { usePersistentState } from "../hooks/usePersistentState";
import { buildIcs, downloadIcs, eventToIcsEntry } from "../notifications/ics";
import { formatClock, formatDuration, getProgress } from "../utils/countdown";
import { EVENT_STATUS_LABEL, eventTypeLabel, FORMAT_LABEL, FORMATS, LOCAL_REGIONS, regionLabel } from "../utils/labels";
import { EVENT_STATUS_TONE, rankEvents } from "../utils/status";
import { formatSASTDateTime, formatSASTLongDate, formatSASTShortDate, formatSASTTime, SAST_LABEL } from "../utils/time";
import {
  availableRegions,
  classifyTournament,
  daysRemainingLabel,
  modeShort,
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_CATEGORY_LABEL,
  type TournamentCategory,
} from "../utils/tournaments";
import { ChipFilter } from "./ChipFilter";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { FactList, type Fact } from "./FactList";
import { ChevronDown, EventEmblem, TrophyIcon } from "./Icons";
import { Panel, useFocusTarget, type FocusRequest } from "./Panel";
import { ProgressBar } from "./ProgressBar";
import { SourceLink } from "./SourceLink";

type StatusFilter = "upcoming" | "active" | "finished" | "cancelled";
type TypeFilter = TournamentCategory | "all";
type FormatFilter = TeamFormat | "all";

const STATUS_OPTIONS: StatusFilter[] = ["upcoming", "active", "finished", "cancelled"];
const TYPE_OPTIONS: TypeFilter[] = ["all", ...TOURNAMENT_CATEGORIES];
const FORMAT_OPTIONS: FormatFilter[] = ["all", ...FORMATS];
const FORMAT_SHORT: Record<TeamFormat, string> = { solo: "Solo", duos: "Duo", trios: "Trio", squads: "Squad" };
const STATUS_SHORT: Record<StatusFilter, string> = { upcoming: "upcoming", active: "live", finished: "completed", cancelled: "cancelled" };
const STATUS_HEADING: Record<StatusFilter, string> = {
  upcoming: "Upcoming Tournaments",
  active: "Live Tournaments",
  finished: "Completed Tournaments",
  cancelled: "Cancelled Tournaments",
};

const isStatus = (v: unknown): v is StatusFilter => STATUS_OPTIONS.includes(v as StatusFilter);
const isType = (v: unknown): v is TypeFilter => TYPE_OPTIONS.includes(v as TypeFilter);
const isFormat = (v: unknown): v is FormatFilter => FORMAT_OPTIONS.includes(v as FormatFilter);
const isRegion = (v: unknown): v is string => typeof v === "string";

const COLLAPSED_ROWS = 3;
const NOT_PUBLISHED = "Not published";

interface Row {
  event: CompetitiveEvent;
  status: CompetitiveStatus;
  category: TournamentCategory;
}

/** "FNCS" vs "FNCS", "Cash Cup" vs "Cash Cups" — treat as the same label. */
const sameLabel = (a: string, b: string) => a.toLowerCase().replace(/s$/, "") === b.toLowerCase().replace(/s$/, "");

const DESCRIPTION_CLAMP = 220;

/** Epic's descriptions can run to a full paragraph — keep rows compact and let the reader expand. */
function Description({ text }: { text: string }) {
  const [more, setMore] = useState(false);
  const long = text.length > DESCRIPTION_CLAMP;
  return (
    <div className="row__description">
      <p className={long && !more ? "row__description--clamped" : undefined}>{text}</p>
      {long && (
        <button type="button" className="row__more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function EventRow({ row, now, open, onToggle }: { row: Row; now: number; open: boolean; onToggle: () => void }) {
  const { event, status, category } = row;
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const req = event.requirements;
  const detailId = `event-${event.id}-detail`;
  const rescheduledFrom = event.previousStartsAt?.[event.previousStartsAt.length - 1];

  const facts: Fact[] = [
    { label: "Starts", value: `${formatSASTLongDate(start)} · ${formatSASTTime(start)} ${SAST_LABEL}` },
    { label: "Ends", value: `${formatSASTLongDate(end)} · ${formatSASTTime(end)} ${SAST_LABEL}` },
    { label: "Duration", value: formatDuration(end.getTime() - start.getTime()) },
    { label: "Mode", value: event.mode },
    { label: "Format", value: event.format ? FORMAT_LABEL[event.format] : "Not specified", muted: !event.format },
    { label: "Region", value: regionLabel(event.region) },
    ...(event.roundType ? [{ label: "Round type", value: event.roundType }] : []),
    { label: "Prize", value: event.prizePool ?? NOT_PUBLISHED, muted: !event.prizePool },
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
        <EventEmblem className={`emblem--${category}`} />
        <span className="row__titles">
          <span className="row__title">
            {event.name}
            {event.round && <span className="row__round"> · {event.round}</span>}
          </span>
          <span className="row__chips">
            <span className={`type-chip type-chip--${category}`}>{eventTypeLabel(event.type)}</span>
            {event.format && <span className={`format-chip format-chip--${event.format}`}>{FORMAT_SHORT[event.format]}</span>}
            {modeShort(event.mode) && (
              <span className="mode-chip" title={event.mode}>
                {modeShort(event.mode)}
              </span>
            )}
            <span className={`region-chip${LOCAL_REGIONS.includes(event.region) ? " region-chip--local" : ""}`} title={regionLabel(event.region)}>
              {event.region}
            </span>
            {status === "cancelled" && <span className="flag-chip flag-chip--cancelled">Cancelled</span>}
            {rescheduledFrom && status !== "cancelled" && <span className="flag-chip flag-chip--rescheduled">Rescheduled</span>}
            {event.timeTbd && <span className="flag-chip">Time TBD</span>}
          </span>
          <span className="row__when">
            {formatSASTShortDate(start)} {formatSASTTime(start)} – {formatSASTShortDate(end) === formatSASTShortDate(start) ? "" : `${formatSASTShortDate(end)} `}
            {formatSASTTime(end)} {SAST_LABEL}
          </span>
        </span>
        <span className={`time-pill time-pill--${status === "active" ? "live" : status === "upcoming" ? "upcoming" : "done"}`}>{daysRemainingLabel(event, now, status)}</span>
        <ChevronDown className="row__chev" />
      </button>
      {open && (
        <div className="row__detail" id={detailId}>
          <p className="row__kicker">
            {eventTypeLabel(event.type)} ·{" "}
            {sameLabel(eventTypeLabel(event.type), TOURNAMENT_CATEGORY_LABEL[category]) ? "" : `${TOURNAMENT_CATEGORY_LABEL[category]} · `}
            <span className={`status-text status-text--${EVENT_STATUS_TONE[status]}`}>{EVENT_STATUS_LABEL[status]}</span>
          </p>
          {status === "cancelled" && <p className="row__notes row__notes--alert">{event.cancelledReason ?? "This event was cancelled."}</p>}
          {rescheduledFrom && <p className="row__notes">Rescheduled — originally {formatSASTDateTime(rescheduledFrom)}.</p>}
          {status === "active" && (
            <div className="row__progress">
              <ProgressBar value={getProgress(start, end, now)} tone="green" label="Event progress" />
              <span>Ends in {formatClock(end.getTime() - now)}</span>
            </div>
          )}
          {event.description && <Description text={event.description} />}
          <FactList facts={facts} />
          <div className="requirements">
            <p className="requirements__title">Qualification requirements</p>
            <FactList facts={requirements} className="facts--compact" />
            {req.other && req.other.length > 0 && (
              <ul className="requirements__other">
                {req.other.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </div>
          {event.tags && event.tags.length > 0 && (
            <ul className="highlights" aria-label="Tournament tags">
              {event.tags.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          {event.notes && <p className="row__notes">{event.notes}</p>}
          <div className="row__footer">
            <ConfidenceBadge confidence={event.confidence} />
            <span className="row__links">
              {status === "upcoming" && (
                <button
                  type="button"
                  className="source-link row__calendar"
                  onClick={() => downloadIcs(`${event.id}.ics`, buildIcs([eventToIcsEntry(event)]))}
                >
                  Add to calendar
                </button>
              )}
              {event.rulesUrl && (
                <a className="source-link" href={event.rulesUrl} target="_blank" rel="noopener noreferrer">
                  Official rules ↗
                </a>
              )}
              <SourceLink url={event.sourceUrl} />
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

interface EventsPanelProps {
  events: CompetitiveEvent[];
  now: number;
  focus: FocusRequest | null;
  loading: boolean;
  failed: boolean;
  updatedAt: string | null;
  log: SyncLog | null;
}

export function EventsPanel({ events, now, focus, loading, failed, updatedAt, log }: EventsPanelProps) {
  const [statusFilter, setStatusFilter] = usePersistentState<StatusFilter>("event-status", "upcoming", isStatus);
  const [typeFilter, setTypeFilter] = usePersistentState<TypeFilter>("event-type", "all", isType);
  const [formatFilter, setFormatFilter] = usePersistentState<FormatFilter>("format-filter", "all", isFormat);
  const [regionFilter, setRegionFilter] = usePersistentState<string>("event-region", "all", isRegion);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows: Row[] = useMemo(
    () => rankEvents(events, now).map(({ event, status }) => ({ event, status, category: classifyTournament(event) })),
    // statuses change at most minute-to-minute, so recompute once a minute rather than every second
    [events, Math.floor(now / 60_000)],
  );
  const regions = useMemo(() => availableRegions(events, LOCAL_REGIONS), [events]);
  const region = regionFilter === "all" || regions.includes(regionFilter) ? regionFilter : "all";

  // Each filter's counts reflect the other active filters, so the numbers always add up to what you'd see.
  const matches = (r: Row, skip?: "status" | "type" | "format") =>
    (skip === "status" || r.status === statusFilter) &&
    (skip === "type" || typeFilter === "all" || r.category === typeFilter) &&
    (skip === "format" || formatFilter === "all" || r.event.format === formatFilter) &&
    (region === "all" || r.event.region === region);

  const countBy = <K extends string>(options: K[], skip: "status" | "type" | "format", key: (r: Row) => K | undefined) => {
    const counts = Object.fromEntries(options.map((o) => [o, 0])) as Record<K, number>;
    for (const r of rows) {
      if (!matches(r, skip)) continue;
      const k = key(r);
      if (k !== undefined && k in counts) counts[k]++;
      if ("all" in counts) (counts as Record<string, number>).all++;
    }
    return counts;
  };
  const statusCounts = countBy(STATUS_OPTIONS, "status", (r) => r.status);
  const typeCounts = countBy(TYPE_OPTIONS, "type", (r) => r.category);
  const formatCounts = countBy(FORMAT_OPTIONS, "format", (r) => r.event.format);
  const regionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.status === statusFilter) c[r.event.region] = (c[r.event.region] ?? 0) + 1;
    });
    return c;
  }, [rows, statusFilter]);

  const filtered = rows.filter((r) => matches(r));
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_ROWS);
  const statusOptions = STATUS_OPTIONS.filter((s) => s !== "cancelled" || statusCounts.cancelled > 0 || statusFilter === "cancelled");
  const lastRun = log?.runs[0];

  useFocusTarget("event", focus, (id) => {
    const row = rows.find((r) => r.event.id === id);
    if (row) {
      setStatusFilter(row.status);
      setTypeFilter("all");
      setFormatFilter("all");
      setRegionFilter("all");
    }
    setExpanded(true);
    setOpenId(id);
  });

  return (
    <Panel
      id="events"
      icon={<TrophyIcon />}
      title="Upcoming Competitive Events"
      expandLabel={filtered.length > COLLAPSED_ROWS || expanded ? `View all ${STATUS_SHORT[statusFilter]} (${filtered.length})` : undefined}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
    >
      <ChipFilter
        options={TYPE_OPTIONS}
        value={typeFilter}
        onChange={setTypeFilter}
        counts={typeCounts}
        label={(t) => (t === "all" ? "All" : TOURNAMENT_CATEGORY_LABEL[t])}
        ariaLabel="Filter tournaments by type"
        className="segmented--panel"
      />
      <div className="mini-filters">
        <label className="mini-select">
          <span className="sr-only">Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filter tournaments by status">
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_LABEL[s]} ({statusCounts[s]})
              </option>
            ))}
          </select>
        </label>
        <label className="mini-select">
          <span className="sr-only">Format</span>
          <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value as FormatFilter)} aria-label="Filter tournaments by team format">
            {FORMAT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f === "all" ? "All formats" : FORMAT_SHORT[f]} ({formatCounts[f]})
              </option>
            ))}
          </select>
        </label>
        <label className="mini-select">
          <span className="sr-only">Region</span>
          <select value={region} onChange={(e) => setRegionFilter(e.target.value)} aria-label="Filter tournaments by region">
            <option value="all">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {regionLabel(r)} ({regionCounts[r] ?? 0})
              </option>
            ))}
          </select>
        </label>
        <span className="mini-filters__count">
          {STATUS_HEADING[statusFilter]} <strong>({filtered.length})</strong>
        </span>
      </div>

      {loading ? (
        <p className="empty-state">Loading tournaments…</p>
      ) : failed && !events.length ? (
        <p className="empty-state">Couldn't load tournaments right now. Please try again shortly.</p>
      ) : visible.length ? (
        <div className="rows">
          {visible.map((row) => (
            <EventRow key={row.event.id} row={row} now={now} open={openId === row.event.id} onToggle={() => setOpenId((cur) => (cur === row.event.id ? null : row.event.id))} />
          ))}
        </div>
      ) : (
        <p className="empty-state">
          {typeFilter === "all" && formatFilter === "all" && regionFilter === "all"
            ? statusFilter === "upcoming"
              ? "No upcoming tournaments are listed right now. Epic usually publishes the next ones a few days ahead."
              : `No ${EVENT_STATUS_LABEL[statusFilter].toLowerCase()} tournaments right now.`
            : `No ${EVENT_STATUS_LABEL[statusFilter].toLowerCase()} tournaments match these filters.`}
        </p>
      )}

      <p className="panel-note">
        {updatedAt ? <>Last updated {formatSASTDateTime(updatedAt)}</> : "Not synced yet"}
        {lastRun && lastRun.status !== "success" && <> · last sync {lastRun.status}</>}. South African players usually queue on EU or ME — those regions are highlighted.
      </p>
    </Panel>
  );
}
