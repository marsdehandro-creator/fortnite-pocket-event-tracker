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

/**
 * Tournament type as a kebab-case slug, taken from Epic's own classification where available
 * (e.g. Epic "CashCup" → "cash-cup", "PerformanceEvaluation" → "performance-evaluation").
 * Deliberately open: any new type Epic introduces is accepted and displayed without code changes.
 * Known slugs only get nicer labels (utils/labels.ts) and filter buckets (utils/tournaments.ts).
 */
export type CompetitiveEventType = string;

/**
 * Matchmaking region code as Epic publishes it ("EU", "ME", "NAE", …). Open for the same reason:
 * a new region appears automatically. South African players normally queue on EU or ME.
 */
export type Region = string;

export type CompetitiveStatus = "upcoming" | "active" | "finished" | "cancelled";

export interface EventRequirements {
  /** e.g. "Diamond I" — omit when not published. */
  minRank?: string;
  minAccountLevel?: number;
  /** Matchmaking regions whose players may enter. */
  regionEligibility: Region[];
  twoFactorRequired?: boolean;
  /** Any other eligibility rule in plain words, e.g. "Accept the event rules". */
  other?: string[];
}

export interface CompetitiveEvent {
  /** Stable id. For Epic-sourced events this is derived from Epic's event window id, so re-syncs update in place. */
  id: string;
  name: string;
  type: CompetitiveEventType;
  region: Region;
  /** Game mode, e.g. "Battle Royale", "Zero Build", "Reload". */
  mode: string;
  /** Omitted when the team size isn't known — the event still displays. */
  format?: TeamFormat;
  /** Session/round label for multi-session events, e.g. "Session 1 - Round 2". */
  round?: string;
  startsAt: IsoDateString;
  endsAt: IsoDateString;
  requirements: EventRequirements;
  confidence: Confidence;
  prizePool?: string;
  notes?: string;
  sourceUrl?: string;

  // --- Fields filled by automated ingestion (all optional so hand-written records stay valid) ---
  /** Epic event group (the tournament), e.g. "S43_TriosCashCup". */
  groupId?: string;
  /** Epic event window id, e.g. "S43_TriosCashCup_Event1_EU". */
  sourceId?: string;
  /** Epic's raw tournament type label, e.g. "CashCup" — kept for transparency. */
  epicType?: string;
  /** Epic round type, e.g. "Qualifiers", "Finals", "Open". */
  roundType?: string;
  description?: string;
  rulesUrl?: string;
  tags?: string[];
  platforms?: string[];
  imageUrl?: string;
  /** True while Epic lists the time as TBD. */
  timeTbd?: boolean;
  /** Set when the event was cancelled or removed from Epic's schedule. */
  cancelled?: boolean;
  cancelledReason?: string;
  /** Earlier start times, oldest first, when an event was rescheduled. */
  previousStartsAt?: IsoDateString[];
  /** When ingestion first and most recently saw this record. */
  firstSeenAt?: IsoDateString;
  lastSeenAt?: IsoDateString;
}

/** One entry in the tournament sync log (public/data/sync-log.json). */
export interface SyncRun {
  startedAt: IsoDateString;
  finishedAt: IsoDateString;
  status: "success" | "partial" | "failed";
  /** Where the events came from, e.g. "epic-schedule (browser)". */
  source: string;
  regions: string[];
  discovered: number;
  added: number;
  updated: number;
  unchanged: number;
  rescheduled: number;
  cancelled: number;
  restored: number;
  rejected: number;
  archived: number;
  errors: string[];
  warnings: string[];
}

export interface SyncLog {
  lastAttemptAt?: IsoDateString;
  lastSuccessAt?: IsoDateString;
  runs: SyncRun[];
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
