import { toDate, type DateInput } from "./time";

export interface CountdownParts {
  /** Signed milliseconds until the target (negative once it has passed). */
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export function splitDuration(ms: number): Omit<CountdownParts, "totalMs" | "isPast"> {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function getCountdown(target: DateInput, now: DateInput): CountdownParts {
  const totalMs = toDate(target).getTime() - toDate(now).getTime();
  return { totalMs, isPast: totalMs <= 0, ...splitDuration(totalMs) };
}

/** Milliseconds elapsed since a start time (0 if it hasn't started). */
export function getElapsedMs(start: DateInput, now: DateInput): number {
  return Math.max(0, toDate(now).getTime() - toDate(start).getTime());
}

/**
 * Human duration: "2h 36m", "3d 4h", "45m", "12s".
 * `maxUnits` caps how many units are shown; `seconds` allows seconds when the duration is under an hour.
 */
export function formatDuration(ms: number, options: { maxUnits?: number; seconds?: boolean } = {}): string {
  const { maxUnits = 2, seconds = false } = options;
  const p = splitDuration(ms);
  const units: string[] = [];
  if (p.days) units.push(`${p.days}d`);
  if (p.hours) units.push(`${p.hours}h`);
  if (p.minutes) units.push(`${p.minutes}m`);
  if (seconds && !p.days && !p.hours && p.seconds) units.push(`${p.seconds}s`);
  if (!units.length) return seconds ? "0s" : "0m";
  return units.slice(0, maxUnits).join(" ");
}

/** Clock-style countdown: "02:36:12", or "3d 04:12:09" when a day or more remains. */
export function formatClock(ms: number): string {
  const p = splitDuration(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
  return p.days ? `${p.days}d ${clock}` : clock;
}

/** Fraction of a window that has elapsed, clamped to 0–1. */
export function getProgress(start: DateInput, end: DateInput, now: DateInput): number {
  const s = toDate(start).getTime();
  const e = toDate(end).getTime();
  if (e <= s) return 1;
  return Math.min(1, Math.max(0, (toDate(now).getTime() - s) / (e - s)));
}
