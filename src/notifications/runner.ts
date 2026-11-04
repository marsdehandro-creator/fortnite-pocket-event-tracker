import type { CompetitiveEvent, UpdateEvent } from "../types/events";
import { isAlertPrefs, planDueAlerts, pruneSent, toNotifications, type AlertNotification } from "./plan";
import { KEYS, kvGet, kvSet } from "./store";

/** Periodic background sync registration tag (page registers it, service worker handles it). */
export const ALERT_SYNC_TAG = "pocket-tracker-alerts";

export interface AlertData {
  events: CompetitiveEvent[];
  updates: UpdateEvent[];
}

/**
 * One alert check: read prefs + already-sent keys, work out what's due, show it, remember it.
 * Used by the open page (every minute) and the service worker (periodic background sync).
 */
export async function runAlertCheck(
  data: AlertData,
  show: (n: AlertNotification) => Promise<void>,
  now: number = Date.now(),
): Promise<number> {
  const prefs = await kvGet<unknown>(KEYS.prefs);
  if (!isAlertPrefs(prefs) || !prefs.enabled) return 0;
  const sent = pruneSent((await kvGet<Record<string, number>>(KEYS.sent)) ?? {}, now);
  const due = planDueAlerts({ events: data.events, updates: data.updates, prefs, now, sent });
  let shown = 0;
  for (const n of toNotifications(due, now)) {
    try {
      await show(n);
      n.keys.forEach((k) => (sent[k] = now));
      shown++;
    } catch {
      /* leave unsent so the next check retries */
    }
  }
  await kvSet(KEYS.sent, sent);
  await kvSet(KEYS.lastCheck, now);
  return shown;
}
