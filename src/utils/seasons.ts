import type { Season } from "../types/intel";
import { toDate, type DateInput } from "./time";

/** The season running now: the latest one that has started (and not ended, when an end is known). */
export function getCurrentSeason(seasons: Season[], now: DateInput): Season | null {
  const t = toDate(now).getTime();
  return (
    [...seasons]
      .filter((s) => Date.parse(s.startsAt) <= t && (!s.endsAt || Date.parse(s.endsAt) > t))
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null
  );
}

export function seasonName(seasons: Season[], id: string): string {
  return seasons.find((s) => s.id === id)?.name ?? id;
}
