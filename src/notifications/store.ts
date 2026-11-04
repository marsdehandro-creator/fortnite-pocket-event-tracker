/**
 * Tiny IndexedDB key-value store for alert state. Shared by the page and the service worker (which can't read
 * localStorage). Every call fails soft: if storage is blocked (private mode, cleared site data) alerts simply
 * fall back to in-memory state for this session.
 */

const DB_NAME = "pocket-tracker-alerts";
const STORE = "kv";

export const KEYS = { prefs: "prefs", sent: "sent", lastCheck: "lastCheck" } as const;

const memory = new Map<string, unknown>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    }).finally(() => db.close());
  } catch {
    return memory.get(key) as T | undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }).finally(() => db.close());
  } catch {
    /* kept in memory only */
  }
}
