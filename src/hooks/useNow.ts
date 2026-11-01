import { useSyncExternalStore } from "react";

/**
 * One shared clock for the whole page: a single timer aligned to the top of each second drives every countdown,
 * instead of one interval per card. Re-syncs immediately when the tab becomes visible again.
 */

let now = Date.now();
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function schedule() {
  timer = setTimeout(() => {
    emit();
    schedule();
  }, 1000 - (Date.now() % 1000) + 5);
}

function onVisibility() {
  if (document.visibilityState === "visible") emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    emit();
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

const getSnapshot = () => now;

/** Current epoch milliseconds, updated every second. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
