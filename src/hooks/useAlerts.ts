import { useCallback, useEffect, useRef, useState } from "react";
import type { CompetitiveEvent, UpdateEvent } from "../types/events";
import {
  currentPermission,
  detectSupport,
  disableBackgroundChecks,
  enableBackgroundChecks,
  registerAlertWorker,
  showFromPage,
  type AlertSupport,
  type PermissionState,
} from "../notifications/client";
import { DEFAULT_ALERT_PREFS, isAlertPrefs, type AlertPrefs } from "../notifications/plan";
import { runAlertCheck } from "../notifications/runner";
import { KEYS, kvSet } from "../notifications/store";
import { usePersistentState } from "./usePersistentState";

const CHECK_EVERY_MS = 60_000;

export interface AlertsState {
  prefs: AlertPrefs;
  setPrefs: (update: (p: AlertPrefs) => AlertPrefs) => void;
  permission: PermissionState;
  support: AlertSupport;
  /** True once background checks were granted for this device (installed app on Chrome/Edge). */
  background: boolean;
  enable: () => Promise<PermissionState>;
  disable: () => void;
  sendTest: () => Promise<boolean>;
}

/**
 * Per-device alert settings + the in-page checker. While the site is open (any tab, even in the background),
 * due alerts are checked every minute. When it's closed, the service worker's periodic sync takes over where the
 * browser allows it.
 */
export function useAlerts(events: CompetitiveEvent[], updates: UpdateEvent[]): AlertsState {
  const [prefs, setPrefsState] = usePersistentState<AlertPrefs>("alerts", DEFAULT_ALERT_PREFS, isAlertPrefs);
  const [permission, setPermission] = useState<PermissionState>(currentPermission);
  const [support] = useState<AlertSupport>(detectSupport);
  const [background, setBackground] = useState(false);
  const data = useRef({ events, updates });
  data.current = { events, updates };

  const active = prefs.enabled && permission === "granted";

  // The service worker reads prefs from IndexedDB (it can't see localStorage).
  useEffect(() => {
    void kvSet(KEYS.prefs, prefs);
  }, [prefs]);

  // Keep the worker registered (and updated) on every visit while alerts are on.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void registerAlertWorker().then(async (reg) => {
      const ok = await enableBackgroundChecks(reg);
      if (!cancelled) setBackground(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  // In-page checker.
  const check = useCallback(() => {
    if (!data.current.events.length && !data.current.updates.length) return;
    void runAlertCheck(data.current, showFromPage);
  }, []);
  useEffect(() => {
    if (!active) return;
    check();
    const id = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, check, events, updates]);

  const setPrefs = useCallback((update: (p: AlertPrefs) => AlertPrefs) => setPrefsState((p) => update(p)), [setPrefsState]);

  const enable = useCallback(async (): Promise<PermissionState> => {
    if (typeof Notification === "undefined") return "unsupported";
    // Must run inside the click handler — browsers only show the permission prompt for a user gesture.
    const result = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPermission(result);
    if (result === "granted") setPrefsState((p) => ({ ...p, enabled: true }));
    return result;
  }, [setPrefsState]);

  const disable = useCallback(() => {
    setPrefsState((p) => ({ ...p, enabled: false }));
    setBackground(false);
    void disableBackgroundChecks();
  }, [setPrefsState]);

  const sendTest = useCallback(async () => {
    if (currentPermission() !== "granted") return false;
    try {
      await registerAlertWorker();
      await showFromPage({
        tag: "test-alert",
        title: "Alerts are on",
        body: "You'll get tournament and update alerts 2 days and 2 hours before they start.",
        url: "./#events",
        keys: [],
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  return { prefs, setPrefs, permission, support, background, enable, disable, sendTest };
}
