import type { AlertNotification } from "./plan";
import { ALERT_SYNC_TAG } from "./runner";

/** What this device/browser can do — drives the honest "how alerts reach you" copy in the settings. */
export interface AlertSupport {
  notifications: boolean;
  serviceWorker: boolean;
  /** Background checks while the site is closed (Chromium, installed app only). */
  periodicSync: boolean;
  /** Running as an installed / home-screen app. */
  standalone: boolean;
  ios: boolean;
}

export function detectSupport(): AlertSupport {
  if (typeof window === "undefined") return { notifications: false, serviceWorker: false, periodicSync: false, standalone: false, ios: false };
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    notifications: "Notification" in window,
    serviceWorker: "serviceWorker" in navigator,
    periodicSync: "serviceWorker" in navigator && "periodicSync" in ServiceWorkerRegistration.prototype,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true,
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  };
}

export type PermissionState = NotificationPermission | "unsupported";

export const currentPermission = (): PermissionState => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

interface PeriodicSyncManager {
  register(tag: string, o: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
}
const periodicSyncOf = (reg: ServiceWorkerRegistration) => (reg as ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager }).periodicSync;

/** Registers the (non-caching) service worker that runs background checks and handles alert taps. */
export async function registerAlertWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(new URL("sw.js", document.baseURI).href, { scope: "./" });
  } catch {
    return null;
  }
}

/**
 * Asks for background checks. Chrome only grants this for installed apps and decides the real frequency itself
 * (often only a few times a day), so the 2-hour alert can be late or missed while the site is closed.
 */
export async function enableBackgroundChecks(reg: ServiceWorkerRegistration | null): Promise<boolean> {
  const sync = reg && periodicSyncOf(reg);
  if (!sync) return false;
  try {
    const status = await navigator.permissions.query({ name: "periodic-background-sync" as PermissionName });
    if (status.state !== "granted") return false;
    await sync.register(ALERT_SYNC_TAG, { minInterval: 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

export async function disableBackgroundChecks() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await (reg && periodicSyncOf(reg))?.unregister(ALERT_SYNC_TAG);
  } catch {
    /* nothing registered */
  }
}

/** Shows an alert from the page. Android requires going through the service worker; elsewhere a plain Notification works too. */
export async function showFromPage(n: AlertNotification): Promise<void> {
  const url = new URL(n.url, document.baseURI).href;
  const icon = new URL("icon-512.png", document.baseURI).href;
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (reg) {
    await reg.showNotification(n.title, { body: n.body, tag: n.tag, icon, data: { url } });
    return;
  }
  const note = new Notification(n.title, { body: n.body, tag: n.tag, icon });
  note.onclick = () => {
    window.focus();
    window.location.href = url;
    note.close();
  };
}
