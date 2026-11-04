/**
 * Service worker — bundled to /sw.js by the `service-worker` plugin in vite.config.ts.
 *
 * It does NOT cache or intercept anything (no fetch handler), so it can never serve a stale site.
 * Its only jobs:
 *  - periodic background sync (Chrome/Edge, when the site is installed as an app): fetch the latest
 *    tournaments + updates and show any alerts that are due, even when the site isn't open;
 *  - open/focus the site when an alert is tapped.
 *
 * The DOM lib has no service-worker types, so the few we need are declared locally.
 */
import type { CompetitiveEvent, UpdateEvent } from "../types/events";
import type { AlertNotification } from "../notifications/plan";
import { ALERT_SYNC_TAG, runAlertCheck } from "../notifications/runner";
import { isCompetitiveEvent, isUpdateEvent } from "../utils/validate";

interface SwExtendableEvent extends Event {
  waitUntil(p: Promise<unknown>): void;
}
interface SwPeriodicSyncEvent extends SwExtendableEvent {
  tag: string;
}
interface SwNotificationEvent extends SwExtendableEvent {
  notification: Notification & { data?: { url?: string } };
}
interface SwClient {
  url: string;
  focus(): Promise<SwClient>;
  navigate(url: string): Promise<SwClient | null>;
}
interface SwScope {
  registration: ServiceWorkerRegistration;
  clients: {
    matchAll(o: { type: "window"; includeUncontrolled: boolean }): Promise<SwClient[]>;
    openWindow(url: string): Promise<SwClient | null>;
    claim(): Promise<void>;
  };
  skipWaiting(): Promise<void>;
  addEventListener(type: string, listener: (e: never) => void): void;
}

const sw = self as unknown as SwScope;

const scopeUrl = (path: string) => new URL(path, sw.registration.scope).href;

async function fetchItems<T>(path: string, valid: (v: unknown) => v is T): Promise<T[]> {
  const res = await fetch(scopeUrl(path), { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const body = (await res.json()) as { items?: unknown };
  return Array.isArray(body.items) ? body.items.filter(valid) : [];
}

async function show(n: AlertNotification) {
  await sw.registration.showNotification(n.title, {
    body: n.body,
    tag: n.tag,
    icon: scopeUrl("icon-512.png"),
    badge: scopeUrl("favicon.svg"),
    data: { url: scopeUrl(n.url) },
  });
}

async function backgroundCheck() {
  // Each source fails independently — one missing file must not block the other's alerts.
  const [events, updates] = await Promise.all([
    fetchItems<CompetitiveEvent>("data/tournaments.json", isCompetitiveEvent).catch(() => []),
    fetchItems<UpdateEvent>("data/updates.json", isUpdateEvent).catch(() => []),
  ]);
  await runAlertCheck({ events, updates }, show);
}

sw.addEventListener("install", () => void sw.skipWaiting());
sw.addEventListener("activate", (e: SwExtendableEvent) => e.waitUntil(sw.clients.claim()));

sw.addEventListener("periodicsync", (e: SwPeriodicSyncEvent) => {
  if (e.tag === ALERT_SYNC_TAG) e.waitUntil(backgroundCheck());
});

sw.addEventListener("notificationclick", (e: SwNotificationEvent) => {
  e.notification.close();
  const url = e.notification.data?.url ?? sw.registration.scope;
  e.waitUntil(
    (async () => {
      const wins = await sw.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = wins.find((w) => w.url.startsWith(sw.registration.scope));
      if (open) {
        await open.navigate(url).catch(() => null);
        await open.focus();
      } else {
        await sw.clients.openWindow(url);
      }
    })(),
  );
});
