import { useState } from "react";
import type { UpdateEvent, UpdateStatus } from "../types/events";
import { formatClock, formatDuration, getElapsedMs, getProgress } from "../utils/countdown";
import { UPDATE_KIND_LABEL, UPDATE_STATUS_LABEL } from "../utils/labels";
import { getUpdateDurationMs, getUpdateEnd, rankUpdates, UPDATE_STATUS_TONE } from "../utils/status";
import { formatSASTLongDate, formatSASTShortDate, formatSASTTime, formatSASTWhen, SAST_LABEL } from "../utils/time";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { FactList, type Fact } from "./FactList";
import { ChevronDown, WrenchIcon } from "./Icons";
import { Panel, useFocusTarget, type FocusRequest } from "./Panel";
import { ProgressBar } from "./ProgressBar";
import { SourceLink } from "./SourceLink";

const COLLAPSED_ROWS = 3;
const sast = (d: Date | string) => `${formatSASTTime(d)} ${SAST_LABEL}`;

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="row__stat">
      <span className="row__stat-label">{label}</span>
      <span className={`row__stat-value${tone ? ` is-${tone}` : ""}`}>{value}</span>
    </div>
  );
}

function UpdateRow({ update, status, now, open, onToggle }: { update: UpdateEvent; status: UpdateStatus; now: number; open: boolean; onToggle: () => void }) {
  const tone = UPDATE_STATUS_TONE[status];
  const start = new Date(update.downtimeStartsAt);
  const end = getUpdateEnd(update);
  const duration = getUpdateDurationMs(update);
  const estimated = !update.actualEndAt;
  const detailId = `update-${update.id}-detail`;

  let stats: [string, string, string?][];
  switch (status) {
    case "maintenance":
      stats = [
        ["Running", formatClock(getElapsedMs(start, now)), "red"],
        ["Est. return", `~ ${sast(end)}`],
      ];
      break;
    case "upcoming":
      stats = [
        ["Starts in", formatDuration(start.getTime() - now, { maxUnits: 3 })],
        ["Est. duration", formatDuration(duration)],
      ];
      break;
    case "live":
      stats = [
        ["Servers back", formatSASTWhen(end, now).replace(` ${SAST_LABEL}`, "")],
        ["Downtime", formatDuration(duration)],
      ];
      break;
    default:
      stats = [
        ["Date", formatSASTShortDate(start)],
        ["Downtime", formatDuration(duration)],
      ];
  }

  const facts: Fact[] = [
    { label: "Date", value: formatSASTLongDate(start) },
    ...(update.matchmakingDisabledAt ? [{ label: "Matchmaking off", value: sast(update.matchmakingDisabledAt) }] : []),
    { label: status === "upcoming" ? "Downtime starts" : "Downtime started", value: sast(start) },
    { label: estimated ? "Estimated return" : "Servers returned", value: sast(end) },
    { label: estimated ? "Expected duration" : "Total downtime", value: formatDuration(duration) },
  ];

  return (
    <article className={`row row--${tone}${open ? " is-open" : ""}`} id={`update-${update.id}`}>
      <button type="button" className="row__main" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
        <span className="row__lead">
          <span className={`status-chip status-chip--${tone}`}>
            <span className={`dot dot--${tone}${status === "maintenance" ? " dot--pulse" : ""}`} aria-hidden="true" />
            {UPDATE_STATUS_LABEL[status]}
          </span>
          <span className="row__titles">
            <span className="row__title">{update.version ? `v${update.version}` : update.kind === "service-maintenance" ? "Maintenance" : UPDATE_KIND_LABEL[update.kind]}</span>
            <span className="row__sub">{update.name}</span>
          </span>
        </span>
        {stats.map(([label, value, statTone]) => (
          <Stat key={label} label={label} value={value} tone={statTone} />
        ))}
        <ChevronDown className="row__chev" />
      </button>
      {open && (
        <div className="row__detail" id={detailId}>
          {status === "maintenance" && (
            <div className="row__progress">
              <ProgressBar value={getProgress(start, end, now)} tone="red" label="Downtime progress against the expected duration" />
              <span>
                {formatDuration(getElapsedMs(start, now))} of an expected {formatDuration(duration)}
              </span>
            </div>
          )}
          <FactList facts={facts} />
          {update.notes && <p className="row__notes">{update.notes}</p>}
          <div className="row__footer">
            <ConfidenceBadge confidence={update.confidence} />
            <SourceLink url={update.sourceUrl} />
          </div>
        </div>
      )}
    </article>
  );
}

export function UpdatesPanel({ updates, now, focus }: { updates: UpdateEvent[]; now: number; focus: FocusRequest | null }) {
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const ranked = rankUpdates(updates, now);
  const visible = expanded ? ranked : ranked.slice(0, COLLAPSED_ROWS);

  useFocusTarget("update", focus, (id) => {
    if (ranked.findIndex((r) => r.update.id === id) >= COLLAPSED_ROWS) setExpanded(true);
    setOpenId(id);
  });

  return (
    <Panel
      id="updates"
      icon={<WrenchIcon />}
      title="Latest Updates & Downtime"
      expandLabel={ranked.length > COLLAPSED_ROWS ? "View all updates" : undefined}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
    >
      {visible.length ? (
        <div className="rows">
          {visible.map(({ update, status }) => (
            <UpdateRow
              key={update.id}
              update={update}
              status={status}
              now={now}
              open={openId === update.id}
              onToggle={() => setOpenId((cur) => (cur === update.id ? null : update.id))}
            />
          ))}
        </div>
      ) : (
        <p className="empty-state">No updates or maintenance announced right now.</p>
      )}
    </Panel>
  );
}
