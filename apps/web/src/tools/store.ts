/* Tiny IndexedDB key-value store for the free tools: autosaved sessions (including the media files
   themselves, which IndexedDB can hold as Blobs) and the subtitle → editor hand-off. Stays on the device. */

const DB = "alter-effects-tools", STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = t.onabort = () => reject(t.error ?? req.error);
    });
  } finally {
    db.close();
  }
}

export const getItem = <T>(key: string) => tx<T | undefined>("readonly", s => s.get(key) as IDBRequest<T | undefined>).catch(() => undefined);
export const setItem = (key: string, value: unknown) => tx("readwrite", s => s.put(value, key)).then(() => true).catch(e => { console.warn("[tools] autosave failed", e); return false; });
export const removeItem = (key: string) => tx("readwrite", s => s.delete(key)).catch(() => undefined);

export const KEYS = { subtitles: "session:subtitles", editor: "session:editor", handoff: "handoff:editor" } as const;

/** Debounced saver: call `save(value)` as often as you like; it writes at most every `ms`. */
export function autosaver<T>(key: string, ms = 800) {
  let timer: ReturnType<typeof setTimeout> | null = null, pending: T | null = null;
  const flush = () => { timer = null; if (pending !== null) { const v = pending; pending = null; void setItem(key, v); } };
  return {
    save(v: T) { pending = v; if (!timer) timer = setTimeout(flush, ms); },
    flush,
  };
}
