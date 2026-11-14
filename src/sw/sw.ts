/**
 * Service worker — bundled to /sw.js by the `service-worker` plugin in vite.config.ts.
 *
 * Jobs:
 *  - offline app shell, so the installed app opens without a connection. Pages and data are NETWORK-FIRST
 *    (the cache is only a fallback when offline, so tournaments are never stale online); hashed build assets
 *    under assets/ are cache-first because their names change on every release. Disabled on the dev server;
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
interface SwFetchEvent extends SwExtendableEvent {
  request: Request;
  respondWith(r: Promise<Response> | Response): void;
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

/** Set by the build (vite.config.ts): false on the dev server so local testing never hits a cache. */
declare const __SW_CACHE__: boolean;
const CACHE = "pocket-tracker-v1";
const MAX_ASSETS = 60;
const SHELL = ["./", "manifest.webmanifest", "favicon.svg", "icon-192.png", "icon-512.png"];

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

sw.addEventListener("install", (e: SwExtendableEvent) => {
  void sw.skipWaiting();
  if (__SW_CACHE__) e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map(scopeUrl))).catch(() => undefined));
});

sw.addEventListener("activate", (e: SwExtendableEvent) =>
  e.waitUntil(
    (async () => {
      // Drop caches from older worker versions, and every cache when caching is off (dev).
      for (const key of await caches.keys()) if (!__SW_CACHE__ || key !== CACHE) await caches.delete(key);
      await sw.clients.claim();
    })(),
  ),
);

/** Keep only the newest hashed assets so the cache can't grow release after release. */
async function trimAssets(cache: Cache) {
  const assets = (await cache.keys()).filter((r) => new URL(r.url).pathname.includes("/assets/"));
  for (const old of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(old);
}

async function networkFirst(request: Request, isPage: boolean): Promise<Response> {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") await cache.put(isPage ? scopeUrl("./") : request, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(request, { ignoreSearch: isPage })) ?? (isPage ? await cache.match(scopeUrl("./")) : undefined);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
    await trimAssets(cache);
  }
  return res;
}

sw.addEventListener("fetch", (e: SwFetchEvent) => {
  if (!__SW_CACHE__) return;
  const { request } = e;
  const url = new URL(request.url);
  // Only this site's own GET requests; leave Epic's status API, fonts, ranges and the worker script alone.
  if (request.method !== "GET" || !url.href.startsWith(sw.registration.scope) || request.headers.has("range")) return;
  if (url.pathname.endsWith("/sw.js")) return;
  const isPage = request.mode === "navigate";
  e.respondWith(url.pathname.includes("/assets/") ? cacheFirst(request) : networkFirst(request, isPage));
});

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
