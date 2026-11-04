import type { CompetitiveEvent, UpdateEvent } from "../types/events";
import { eventTypeLabel, FORMAT_LABEL, regionLabel } from "../utils/labels";

/**
 * Calendar export (.ics) with the same two reminders as the in-browser alerts — 2 days and 2 hours before.
 * The phone's calendar delivers these even when the browser is closed, so it's the most reliable alert path.
 */

const PRODID = "-//Fortnite Pocket Event Tracker//Alerts//EN";

const icsDate = (iso: string | number) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 text escaping. */
export const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold lines longer than 75 octets (continuation lines start with a space). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const alarm = (trigger: string, text: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:${trigger}`, `DESCRIPTION:${icsEscape(text)}`, "END:VALARM"];

interface IcsEntry {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description: string;
  url?: string;
  status?: "CANCELLED";
}

export function eventToIcsEntry(e: CompetitiveEvent): IcsEntry {
  const bits = [
    eventTypeLabel(e.type),
    e.format ? FORMAT_LABEL[e.format] : undefined,
    `${regionLabel(e.region)} (${e.region})`,
    e.mode,
    e.round,
  ].filter(Boolean);
  return {
    uid: `${e.id}@pocket-event-tracker`,
    start: e.startsAt,
    end: e.endsAt,
    summary: `${e.name}${e.round ? ` · ${e.round}` : ""} (${e.region})`,
    description: [bits.join(" · "), e.description].filter(Boolean).join("\n\n"),
    url: e.sourceUrl,
    status: e.cancelled ? "CANCELLED" : undefined,
  };
}

export function updateToIcsEntry(u: UpdateEvent): IcsEntry {
  return {
    uid: `${u.id}@pocket-event-tracker`,
    start: u.downtimeStartsAt,
    end: u.actualEndAt ?? u.expectedEndAt,
    summary: `Fortnite downtime: ${u.version ? `v${u.version} · ` : ""}${u.name}`,
    description: ["Servers go down for maintenance.", u.notes].filter(Boolean).join("\n\n"),
    url: u.sourceUrl,
  };
}

export function buildIcs(entries: IcsEntry[], now: number = Date.now()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODID}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Fortnite alerts"];
  for (const x of entries) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${x.uid}`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(x.start)}`,
      `DTEND:${icsDate(x.end)}`,
      `SUMMARY:${icsEscape(x.summary)}`,
      `DESCRIPTION:${icsEscape(x.description)}`,
      ...(x.url ? [`URL:${x.url}`] : []),
      ...(x.status ? [`STATUS:${x.status}`] : []),
      ...alarm("-P2D", `${x.summary} starts in 2 days`),
      ...alarm("-PT2H", `${x.summary} starts in 2 hours`),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Triggers a download of the calendar file (iOS/Android open it straight in the Calendar app). */
export function downloadIcs(filename: string, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
