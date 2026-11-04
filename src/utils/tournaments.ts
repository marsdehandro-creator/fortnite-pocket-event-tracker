import type { CompetitiveEvent, CompetitiveStatus } from "../types/events";
import { formatDuration } from "./countdown";
import { getEventStatus } from "./status";
import { sastDayKey, toDate, type DateInput } from "./time";

/**
 * Filter buckets for the competitive calendar. These only GROUP events for filtering — nothing is
 * excluded: anything that matches no rule (including tournament types Epic invents later) lands in "other"
 * and is still displayed.
 */
export type TournamentCategory = "fncs" | "cash-cup" | "skin-cup" | "community" | "invitational" | "other";

export const TOURNAMENT_CATEGORIES: TournamentCategory[] = ["fncs", "cash-cup", "skin-cup", "community", "invitational", "other"];

export const TOURNAMENT_CATEGORY_LABEL: Record<TournamentCategory, string> = {
  fncs: "FNCS",
  "cash-cup": "Cash Cups",
  "skin-cup": "Skin Cups",
  community: "Community Events",
  invitational: "Invitational Events",
  other: "Other",
};

/** Ordered rules: the first that matches wins. Matched against type slug, Epic's raw type, name and tags. */
const CATEGORY_RULES: [TournamentCategory, RegExp][] = [
  ["fncs", /\bfncs\b|championship series/i],
  ["invitational", /invitational|\binvite\b|\blan\b|global championship/i],
  ["skin-cup", /\bskin\b|outfit|icon ?cup|emote cup|\bog cup\b|reward cup/i],
  ["community", /community|creator|charity|\bfan\b|partner/i],
  ["cash-cup", /cash|victory ?cup|prize cup/i],
];

export function classifyTournament(e: Pick<CompetitiveEvent, "type" | "name" | "epicType" | "tags" | "description">): TournamentCategory {
  const haystack = [e.type.replace(/-/g, " "), e.epicType ?? "", e.name, ...(e.tags ?? [])].join(" | ");
  const byName = CATEGORY_RULES.find(([, re]) => re.test(haystack))?.[0];
  if (byName === "fncs") return byName;
  // Only an explicit "invite-only" statement in Epic's description is trusted — prize wording there is too loose to use.
  if (e.description && /\binvite[- ]only\b|\bby invitation\b|\binvitation[- ]only\b/i.test(e.description)) return "invitational";
  return byName ?? "other";
}

/** Status-aware countdown text, e.g. "Starts in 3 days", "Live · 1h 20m left", "Ended 2 days ago". */
export function daysRemainingLabel(e: CompetitiveEvent, now: DateInput, status: CompetitiveStatus = getEventStatus(e, now)): string {
  const t = toDate(now).getTime();
  const dayDiff = (iso: string) => {
    // whole SAST calendar days between today and the date
    const a = Date.parse(`${sastDayKey(iso)}T00:00:00Z`);
    const b = Date.parse(`${sastDayKey(t)}T00:00:00Z`);
    return Math.round((a - b) / 86_400_000);
  };
  switch (status) {
    case "cancelled":
      return "Cancelled";
    case "active":
      return `Live · ${formatDuration(Date.parse(e.endsAt) - t)} left`;
    case "upcoming": {
      const d = dayDiff(e.startsAt);
      if (d <= 0) return `Starts in ${formatDuration(Date.parse(e.startsAt) - t)}`;
      if (d === 1) return "Starts tomorrow";
      return `Starts in ${d} days`;
    }
    case "finished": {
      const d = -dayDiff(e.endsAt);
      if (d <= 0) return "Ended today";
      if (d === 1) return "Ended yesterday";
      return `Ended ${d} days ago`;
    }
  }
}

/** Distinct regions present in the data, local regions first then alphabetical. */
export function availableRegions(events: CompetitiveEvent[], preferred: string[] = []): string[] {
  const set = new Set(events.map((e) => e.region));
  const pref = preferred.filter((r) => set.has(r));
  return [...pref, ...[...set].filter((r) => !pref.includes(r)).sort()];
}

/**
 * Short mode tag for the collapsed row — Epic often runs Build and Zero Build (or Reload) versions of the same cup at
 * the same time, and without this the two rows look identical. Plain "Battle Royale" gets no tag.
 */
export function modeShort(mode: string): string | null {
  const short = mode.replace(/^Battle Royale · /, "").replace(/Zero Build/g, "ZB").replace(/ · /g, " ");
  return short === "Battle Royale" ? null : short;
}
