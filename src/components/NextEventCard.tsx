import type { CompetitiveEvent, UpdateEvent } from "../types/events";
import { EVENT_TYPE_LABEL, FORMAT_LABEL, UPDATE_KIND_LABEL } from "../utils/labels";
import { getNextItem } from "../utils/status";
import { formatSASTTime, relativeSASTDay, SAST_LABEL } from "../utils/time";
import { Countdown } from "./Countdown";

interface NextEventCardProps {
  now: number;
  updates: UpdateEvent[];
  events: CompetitiveEvent[];
}

export function NextEventCard({ now, updates, events }: NextEventCardProps) {
  const next = getNextItem(updates, events, now);

  if (!next) {
    return (
      <article className="panel next-panel">
        <p className="panel__label">Next known event</p>
        <p className="next-panel__empty">Nothing scheduled yet — check back soon.</p>
      </article>
    );
  }

  const isUpdate = next.kind === "update";
  const title = isUpdate
    ? `${next.item.version ? `v${next.item.version} · ` : ""}${next.item.name}`
    : `${next.item.name}${next.item.round ? ` · ${next.item.round}` : ""}`;
  const meta = isUpdate
    ? UPDATE_KIND_LABEL[next.item.kind]
    : `${EVENT_TYPE_LABEL[next.item.type]} · ${FORMAT_LABEL[next.item.format]} · ${next.item.region}`;
  const countdownLabel = next.inProgress ? (isUpdate ? "Estimated return in" : "Ends in") : "Starts in";
  const anchor = `#${isUpdate ? "update" : "event"}-${next.item.id}`;

  return (
    <article className={`panel next-panel${next.inProgress ? " next-panel--live" : ""}`}>
      <p className="panel__label">{next.inProgress ? "Happening now" : isUpdate ? "Next downtime" : "Next event"}</p>
      <h3 className="next-panel__title">{title}</h3>
      <p className="next-panel__meta">{meta}</p>
      <p className="next-panel__when">
        {next.inProgress ? (isUpdate ? "Back around " : "Until ") : ""}
        {relativeSASTDay(next.at, now)} · {formatSASTTime(next.at)} {SAST_LABEL}
      </p>
      <p className="next-panel__countdown-label">{countdownLabel}</p>
      <Countdown target={next.at} now={now} label={countdownLabel} size="lg" />
      <a className="text-link" href={anchor}>
        View details <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}
