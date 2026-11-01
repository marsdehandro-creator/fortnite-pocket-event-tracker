/**
 * Timezone helpers. Every time on the site is shown in South African Standard Time (Africa/Johannesburg,
 * UTC+2, no daylight saving). Formatting goes through Intl so the zone database stays the source of truth.
 */

export const SAST_TIME_ZONE = "Africa/Johannesburg";
export const SAST_LABEL = "SAST";

export type DateInput = Date | string | number;

export function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

const LOCALE = "en-GB";

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: SAST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const timeWithSecondsFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: SAST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: SAST_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: SAST_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const PARTS_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

const partsFormatter = new Intl.DateTimeFormat(LOCALE, { ...PARTS_OPTIONS, timeZone: SAST_TIME_ZONE });

/** "07:00", or "07:00:12" with seconds. */
export function formatSASTTime(input: DateInput, options: { seconds?: boolean } = {}): string {
  const d = toDate(input);
  return (options.seconds ? timeWithSecondsFormatter : timeFormatter).format(d);
}

/** "Sunday 1 November 2026" */
export function formatSASTLongDate(input: DateInput): string {
  return longDateFormatter.format(toDate(input)).replace(",", "");
}

/** "Sun 1 Nov" */
export function formatSASTShortDate(input: DateInput): string {
  return shortDateFormatter.format(toDate(input)).replace(",", "");
}

/** "Sun 1 Nov · 07:00 SAST" */
export function formatSASTDateTime(input: DateInput): string {
  return `${formatSASTShortDate(input)} · ${formatSASTTime(input)} ${SAST_LABEL}`;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock components of an instant in the given zone (defaults to SAST). */
export function getZonedParts(input: DateInput, timeZone: string = SAST_TIME_ZONE): ZonedParts {
  const formatter =
    timeZone === SAST_TIME_ZONE
      ? partsFormatter
      : new Intl.DateTimeFormat(LOCALE, { ...PARTS_OPTIONS, timeZone });
  const lookup: Record<string, number> = {};
  for (const part of formatter.formatToParts(toDate(input))) {
    if (part.type !== "literal") lookup[part.type] = Number(part.value);
  }
  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour,
    minute: lookup.minute,
    second: lookup.second,
  };
}

/** Offset of a zone from UTC at a given instant, in minutes (SAST → +120). */
export function getTimeZoneOffsetMinutes(input: DateInput, timeZone: string = SAST_TIME_ZONE): number {
  const d = toDate(input);
  const p = getZonedParts(d, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/**
 * Converts a wall-clock time in a zone to an instant. Handy for data entry:
 * zonedTimeToDate("2026-11-01", "07:00") → 2026-11-01T05:00:00Z.
 */
export function zonedTimeToDate(date: string, time: string, timeZone: string = SAST_TIME_ZONE): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getTimeZoneOffsetMinutes(guess, timeZone);
  const result = guess - offset * 60000;
  // Second pass corrects the rare case where the guess straddles a DST change in zones that have one.
  const correctedOffset = getTimeZoneOffsetMinutes(result, timeZone);
  return new Date(guess - correctedOffset * 60000);
}

/** Calendar day key in SAST, e.g. "2026-11-01". */
export function sastDayKey(input: DateInput): string {
  const p = getZonedParts(input);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Sentence-friendly "today at 07:00 SAST" / "Thu 20 Aug at 13:00 SAST". */
export function formatSASTWhen(input: DateInput, now: DateInput): string {
  const day = relativeSASTDay(input, now);
  const dayText = ["Today", "Tomorrow", "Yesterday"].includes(day) ? day.toLowerCase() : day;
  return `${dayText} at ${formatSASTTime(input)} ${SAST_LABEL}`;
}

/** "Today", "Tomorrow", "Yesterday" or "Sun 1 Nov", judged by SAST calendar days. */
export function relativeSASTDay(input: DateInput, now: DateInput): string {
  const day = sastDayKey(input);
  const today = sastDayKey(now);
  const dayMs = 86_400_000;
  if (day === today) return "Today";
  if (day === sastDayKey(toDate(now).getTime() + dayMs)) return "Tomorrow";
  if (day === sastDayKey(toDate(now).getTime() - dayMs)) return "Yesterday";
  return formatSASTShortDate(input);
}
