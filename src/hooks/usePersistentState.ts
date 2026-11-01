import { useEffect, useState } from "react";

const PREFIX = "fortnite-pocket-event-tracker:";

/**
 * useState that remembers a small per-viewer preference (e.g. a filter) in localStorage.
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded.
 */
export function usePersistentState<T>(key: string, initial: T, isValid: (v: unknown) => v is T) {
  const storageKey = PREFIX + key;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
      }
    } catch {
      /* fall through to the default */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* preference just won't persist */
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}
