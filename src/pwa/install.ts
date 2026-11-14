import { useSyncExternalStore } from "react";
import { isIOS, isStandalone } from "./platform";

/**
 * "Install app" button state.
 *
 * - Chrome / Edge / Samsung Internet (Android + desktop) fire `beforeinstallprompt` only while the site is
 *   installable and NOT already installed, so the button appears exactly when it's useful and we can trigger the
 *   browser's own install dialog. `appinstalled` (or opening the installed app) hides it for good.
 * - iPhone/iPad have no install event: the button opens "Share → Add to Home Screen" steps instead. Safari can't
 *   see whether the Home Screen app exists (it keeps separate storage), so the steps sheet has an
 *   "I've added it" action that hides the button in Safari from then on.
 * - Anything else (Firefox desktop, desktop Safari): no button.
 *
 * Listeners are attached at import time (imported from main.tsx) because the browser can fire
 * `beforeinstallprompt` before React mounts.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "prompt" | "ios" | null;

const FLAG = "fortnite-pocket-event-tracker:installed";

const readFlag = () => {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (on: boolean) => {
  try {
    if (on) localStorage.setItem(FLAG, "1");
    else localStorage.removeItem(FLAG);
  } catch {
    /* fine — the button just may reappear on iOS */
  }
};

/** Pure decision, unit-tested. */
export function decideInstallMode(s: { standalone: boolean; hasPrompt: boolean; ios: boolean; installedFlag: boolean }): InstallMode {
  if (s.standalone) return null; // already running as the installed app
  if (s.hasPrompt) return "prompt"; // the browser itself says it's installable and not installed
  if (s.ios && !s.installedFlag) return "ios";
  return null;
}

interface State {
  mode: InstallMode;
  deferred: BeforeInstallPromptEvent | null;
}

let state: State = { mode: null, deferred: null };
const listeners = new Set<() => void>();

function recompute(deferred: BeforeInstallPromptEvent | null = state.deferred) {
  const standalone = isStandalone();
  if (standalone) writeFlag(true); // opened from the device: remember it (shared storage on Android/desktop)
  const mode = decideInstallMode({ standalone, hasPrompt: !!deferred, ios: isIOS(), installedFlag: readFlag() });
  if (mode !== state.mode || deferred !== state.deferred) {
    state = { mode, deferred };
    listeners.forEach((l) => l());
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep the mini-infobar away; we show our own button
    writeFlag(false); // the browser says it isn't installed (e.g. it was uninstalled)
    recompute(e as BeforeInstallPromptEvent);
  });
  window.addEventListener("appinstalled", () => {
    writeFlag(true);
    recompute(null);
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", () => recompute());
  recompute(null);
}

/** Show the browser's install dialog (Chromium). Resolves true if the visitor accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = state.deferred;
  if (!e) return false;
  recompute(null); // a prompt event can only be used once
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") writeFlag(true);
  recompute(null);
  return outcome === "accepted";
}

/** iOS: the visitor says they've added it to the Home Screen. */
export function markInstalled() {
  writeFlag(true);
  recompute(null);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getMode = () => state.mode;

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, getMode, getMode);
}
