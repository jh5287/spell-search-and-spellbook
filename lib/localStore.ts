import { useSyncExternalStore } from "react";

/**
 * A localStorage-backed value that React can subscribe to. The server (and the first
 * hydration pass) sees `initial`, so there's no hydration mismatch; the saved value
 * appears right after. Changes from other tabs are picked up via the `storage` event.
 */
export function createLocalStore<T>(key: string, initial: T, isValid: (v: unknown) => v is T) {
  const listeners = new Set<() => void>();
  let loaded = false;
  let value = initial;

  function load() {
    try {
      const raw = localStorage.getItem(key);
      const parsed: unknown = raw === null ? undefined : JSON.parse(raw);
      value = isValid(parsed) ? parsed : initial;
    } catch {
      value = initial;
    }
    loaded = true;
  }

  function getSnapshot() {
    if (!loaded) load();
    return value;
  }

  function subscribe(listener: () => void) {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key && e.key !== null) return;
      load();
      listener();
    };
    listeners.add(listener);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function set(next: T | ((prev: T) => T)) {
    value = typeof next === "function" ? (next as (prev: T) => T)(getSnapshot()) : next;
    loaded = true; // what was just set is current, even if it can't be written to storage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or unavailable: the value still lives in memory for this session
    }
    listeners.forEach((l) => l());
  }

  /** Forgets the saved value and goes back to `initial`; other open tabs follow via the `storage` event. */
  function clear() {
    value = initial;
    loaded = true;
    try {
      localStorage.removeItem(key);
    } catch {
      // storage unavailable: there was nothing saved to remove
    }
    listeners.forEach((l) => l());
  }

  return { getSnapshot, getServerSnapshot: () => initial, subscribe, set, clear };
}

export type LocalStore<T> = ReturnType<typeof createLocalStore<T>>;

export function useLocalStore<T>(store: LocalStore<T>) {
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return [value, store.set] as const;
}
