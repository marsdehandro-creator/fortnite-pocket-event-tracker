import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, getCountdown, getElapsedMs, getProgress } from "./countdown";

const H = 3_600_000;
const M = 60_000;

describe("countdown", () => {
  it("splits the time remaining", () => {
    const c = getCountdown("2026-11-01T05:00:00Z", "2026-10-31T23:57:14Z");
    expect(c).toMatchObject({ days: 0, hours: 5, minutes: 2, seconds: 46, isPast: false });
  });

  it("flags targets in the past", () => {
    const c = getCountdown("2026-11-01T05:00:00Z", "2026-11-01T06:00:00Z");
    expect(c.isPast).toBe(true);
    expect(c.totalMs).toBe(-H);
  });

  it("never reports negative elapsed time", () => {
    expect(getElapsedMs("2026-11-01T05:00:00Z", "2026-11-01T04:00:00Z")).toBe(0);
    expect(getElapsedMs("2026-11-01T05:00:00Z", "2026-11-01T07:36:00Z")).toBe(2 * H + 36 * M);
  });
});

describe("formatting", () => {
  it("formats durations the way the cards display them", () => {
    expect(formatDuration(2 * H + 36 * M)).toBe("2h 36m");
    expect(formatDuration(4 * H)).toBe("4h");
    expect(formatDuration(3 * 24 * H + 4 * H + 12 * M)).toBe("3d 4h");
    expect(formatDuration(45 * 1000, { seconds: true })).toBe("45s");
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats clock-style timers", () => {
    expect(formatClock(2 * H + 36 * M + 12_000)).toBe("02:36:12");
    expect(formatClock(3 * 24 * H + 4 * H + 12 * M + 9_000)).toBe("3d 04:12:09");
  });

  it("clamps progress to 0–1", () => {
    const s = "2026-11-01T05:00:00Z";
    const e = "2026-11-01T09:00:00Z";
    expect(getProgress(s, e, "2026-11-01T04:00:00Z")).toBe(0);
    expect(getProgress(s, e, "2026-11-01T07:00:00Z")).toBe(0.5);
    expect(getProgress(s, e, "2026-11-01T10:00:00Z")).toBe(1);
  });
});
