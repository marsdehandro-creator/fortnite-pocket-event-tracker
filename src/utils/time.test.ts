import { describe, expect, it } from "vitest";
import {
  formatSASTDateTime,
  formatSASTLongDate,
  formatSASTTime,
  formatSASTWhen,
  getTimeZoneOffsetMinutes,
  relativeSASTDay,
  sastDayKey,
  zonedTimeToDate,
} from "./time";

describe("SAST formatting", () => {
  it("converts UTC instants to South African wall-clock time", () => {
    expect(formatSASTTime("2026-11-01T05:00:00Z")).toBe("07:00");
    expect(formatSASTTime("2026-11-01T05:00:09Z", { seconds: true })).toBe("07:00:09");
  });

  it("uses 00 rather than 24 at midnight", () => {
    expect(formatSASTTime("2026-10-31T22:00:00Z")).toBe("00:00");
  });

  it("rolls the date over at SAST midnight, not UTC midnight", () => {
    // 23:30 UTC on 31 Oct is already 01:30 on 1 Nov in Johannesburg
    expect(sastDayKey("2026-10-31T23:30:00Z")).toBe("2026-11-01");
    expect(formatSASTLongDate("2026-10-31T23:30:00Z")).toBe("Sunday 1 November 2026");
  });

  it("formats a compact date-time with the zone label", () => {
    expect(formatSASTDateTime("2026-11-10T06:00:00Z")).toBe("Tue 10 Nov · 08:00 SAST");
  });

  it("is unaffected by US daylight-saving changes", () => {
    // US clocks fall back on 1 Nov 2026; SAST must stay UTC+2 either side.
    expect(getTimeZoneOffsetMinutes("2026-11-01T05:30:00Z")).toBe(120);
    expect(getTimeZoneOffsetMinutes("2026-11-01T06:30:00Z")).toBe(120);
  });
});

describe("zone conversion", () => {
  it("turns SAST wall time into the right instant", () => {
    expect(zonedTimeToDate("2026-11-01", "07:00").toISOString()).toBe("2026-11-01T05:00:00.000Z");
  });

  it("handles zones with daylight saving", () => {
    // 1 AM in New York on 1 Nov 2026 is ambiguous; 9 AM is unambiguous EST (UTC-5).
    expect(zonedTimeToDate("2026-11-01", "09:00", "America/New_York").toISOString()).toBe("2026-11-01T14:00:00.000Z");
    expect(zonedTimeToDate("2026-07-01", "09:00", "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });
});

describe("relative days", () => {
  const now = "2026-11-01T00:00:00Z"; // 02:00 SAST, Sun 1 Nov

  it("labels today/tomorrow/yesterday by SAST calendar day", () => {
    expect(relativeSASTDay("2026-11-01T05:00:00Z", now)).toBe("Today");
    expect(relativeSASTDay("2026-11-01T22:30:00Z", now)).toBe("Tomorrow"); // 00:30 SAST on 2 Nov
    expect(relativeSASTDay("2026-10-31T12:00:00Z", now)).toBe("Yesterday");
    expect(relativeSASTDay("2026-11-10T06:00:00Z", now)).toBe("Tue 10 Nov");
  });

  it("builds sentence-friendly phrases without lowercasing dates", () => {
    expect(formatSASTWhen("2026-11-01T05:00:00Z", now)).toBe("today at 07:00 SAST");
    expect(formatSASTWhen("2026-08-20T11:00:00Z", now)).toBe("Thu 20 Aug at 13:00 SAST");
  });
});
