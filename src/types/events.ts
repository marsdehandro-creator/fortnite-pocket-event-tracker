/**
 * Data contracts for the tracker. Static JSON in src/data/ and any future API must match these shapes.
 * All timestamps are ISO-8601 strings with an explicit offset (e.g. "2026-11-01T07:00:00+02:00" or "...Z").
 * Statuses are never stored — they are derived from the timestamps and the current time (see utils/status.ts).
 */

import type { MapChange, MapDiscovery, POIRanking, Season } from "./intel";

export type IsoDateString = string;

/** How much the timing can be trusted. Shown on every card. */
export type Confidence =
  | "official" // Epic announced it (status page, @FortniteStatus, fortnite.com)
  | "reported" // reputable outlets/dataminers, not confirmed by Epic
  | "estimated"; // our own estimate, e.g. a typical downtime length

// ---------------------------------------------------------------------------
// Updates & downtime
// ---------------------------------------------------------------------------

export type UpdateKind = "season-launch" | "patch" | "hotfix" | "service-maintenance";

export type UpdateStatus =
  | "upcoming" // downtime announced, not started (orange)
  | "maintenance" // servers down right now (red)
  | "live" // most recent game update whose downtime has ended — the version currently live (green)
  | "completed"; // older, finished (grey)

export interface UpdateEvent {
  id: string;
  name: string;
  /** Game version such as "43.00"; null for service-only maintenance. */
  version: string | null;
  kind: UpdateKind;
  /** When matchmaking is switched off, if announced (usually ~30 min before downtime). */
  matchmakingDisabledAt?: IsoDateString;
  downtimeStartsAt: IsoDateString;
  /** Best known estimate of when servers return. */
  expectedEndAt: IsoDateString;
  /** Set once servers are confirmed back; overrides expectedEndAt for status and duration. */
  actualEndAt?: IsoDateString;
  confidence: Confidence;
  notes?: string;
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Competitive events
// ---------------------------------------------------------------------------

export type TeamFormat = "solo" | "duos" | "trios" | "squads";

export type CompetitiveEventType =
  | "cash-cup"
  | "victory-cup"
  | "fncs"
  | "creator-cup"
  | "ranked-cup"
  | "tournament";

/** Fortnite matchmaking regions. South African players normally queue on EU or ME. */
export type Region = "EU" | "ME" | "NAC" | "NAW" | "BR" | "ASIA" | "OCE";

export type CompetitiveStatus = "upcoming" | "active" | "finished";

export interface EventRequirements {
  /** e.g. "Platinum I" — omit when not published. */
  minRank?: string;
  minAccountLevel?: number;
  /** Matchmaking regions whose players may enter. */
  regionEligibility: Region[];
  twoFactorRequired?: boolean;
}

export interface CompetitiveEvent {
  id: string;
  name: string;
  type: CompetitiveEventType;
  region: Region;
  /** Game mode, e.g. "Battle Royale · Reload", "Zero Build". */
  mode: string;
  format: TeamFormat;
  /** Session/round label for multi-session events, e.g. "Qualifier 1". */
  round?: string;
  startsAt: IsoDateString;
  endsAt: IsoDateString;
  requirements: EventRequirements;
  confidence: Confidence;
  prizePool?: string;
  notes?: string;
  sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Data source
// ---------------------------------------------------------------------------

export interface TrackerData {
  updates: UpdateEvent[];
  events: CompetitiveEvent[];
  seasons: Season[];
  discoveries: MapDiscovery[];
  pois: POIRanking[];
  mapChanges: MapChange[];
  /** Where this data came from — the bundled JSON or a live API. */
  source: "static" | "api";
  /** When the underlying dataset was last curated or fetched. */
  updatedAt: IsoDateString;
}

/** Implemented by every data provider (static JSON today, an HTTP API later). */
export interface TrackerDataSource {
  load(signal?: AbortSignal): Promise<TrackerData>;
}
