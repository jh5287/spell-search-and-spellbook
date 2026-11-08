import { backupData, importBackup, parseBackupData, snapshotContents, type BackupContents } from "./backup";
import { EMPTY_TRACKER, hasTracker } from "./slots";
import { addToBook, bookView, spellBook } from "./spellbook";
import { slotTracker } from "./slots";

/**
 * Keeps the data in this browser and a copy in the user's account in step, like a document that saves
 * itself. The browser copy is always the one the UI works from, so the app works offline and instantly;
 * the account copy follows it a moment after every change.
 *
 * Every save names the revision it was based on, so two devices can never silently overwrite each other:
 * the loser is told, and a person decides what to keep.
 */

export class CloudError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "auth" | "other",
  ) {
    super(message);
  }
}

export interface CloudRow {
  data: unknown;
  revision: number;
}

/** The small slice of a backend this needs. The real one is in cloud.ts; tests use an in-memory one. */
export interface CloudApi {
  fetchRow(userId: string): Promise<CloudRow | null>;
  /** Creates the account's row. Returns its revision, or "conflict" if a row already exists. */
  insertRow(userId: string, data: unknown): Promise<number | "conflict">;
  /** Replaces the data only if the row is still at `revision`. Returns the new revision, or "conflict". */
  updateRow(userId: string, data: unknown, revision: number): Promise<number | "conflict">;
}

export type Contents = Required<BackupContents>;
export type SyncStatus = "off" | "loading" | "saved" | "saving" | "offline" | "error" | "conflict";
export type ConflictChoice = "merge" | "cloud" | "device";

export interface Conflict {
  cloud: Contents;
  local: Contents;
  revision: number;
}

export interface SyncState {
  status: SyncStatus;
  message: string | null;
  conflict: Conflict | null;
}

export interface SyncOptions {
  /** How long to wait after the last change before saving. */
  debounceMs?: number;
  /** First retry delay after a failure; doubles each time, up to 30 seconds. */
  retryBaseMs?: number;
  /** Fewest milliseconds between checks for changes made on another device. */
  refreshMs?: number;
}

const OFF: SyncState = { status: "off", message: null, conflict: null };

// --- helpers ---------------------------------------------------------------------------------

/** Fills in anything missing so a partial copy compares and applies like a full one. */
export function normalize(c: BackupContents): Contents {
  return { spells: c.spells ?? [], view: c.view ?? "full", tracker: c.tracker ?? EMPTY_TRACKER };
}

export function isBlank(c: Contents): boolean {
  return c.spells.length === 0 && !hasTracker(c.tracker);
}

/** JSON with sorted keys. Postgres jsonb stores keys in its own order, so plain JSON.stringify would make
 *  identical data look different after a round trip through the account. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** A 53-bit hash (cyrb53): plenty to tell whether something changed. */
function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const hashContents = (c: Contents) => hashString(stableStringify(c));

/** Both books together: the account's order first, then anything only this device has. */
export function mergeContents(cloud: Contents, local: Contents): Contents {
  return {
    spells: local.spells.reduce(addToBook, cloud.spells),
    view: cloud.view,
    tracker: hasTracker(cloud.tracker) ? cloud.tracker : local.tracker,
  };
}

// What this browser last agreed on with the account: the revision it was at, and a hash of the data then.
// Comparing against it tells "I changed something" apart from "someone else did".
const META_KEY = "spellbook:sync";

interface Meta {
  userId: string;
  revision: number;
  hash: string;
}

function readMeta(userId: string): Meta | null {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? "null") as Partial<Meta> | null;
    return m && m.userId === userId && Number.isInteger(m.revision) && typeof m.hash === "string" ? (m as Meta) : null;
  } catch {
    return null;
  }
}

function writeMeta(meta: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // storage full or unavailable: the next save just compares against older notes
  }
}

export function clearSyncMeta() {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    // nothing saved to remove
  }
}

// --- the engine ------------------------------------------------------------------------------

export function createSyncEngine(api: CloudApi, options: SyncOptions = {}) {
  const debounceMs = options.debounceMs ?? 1500;
  const retryBaseMs = options.retryBaseMs ?? 2000;
  const refreshMs = options.refreshMs ?? 10_000;

  const listeners = new Set<() => void>();
  let state = OFF;
  let userId: string | null = null;
  /** Bumped on every start and stop, so work still in flight for an old sign-in can tell and quit. */
  let session = 0;
  /** Nothing is saved until the account's copy has been read at least once. */
  let needsReconcile = true;
  /** Set when the account's copy is unreadable: saving over it could destroy it. */
  let halted = false;
  let attempts = 0;
  let lastCheckAt = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let cleanups: (() => void)[] = [];
  let chain: Promise<unknown> = Promise.resolve();

  function setState(patch: Partial<SyncState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  }

  /** One thing at a time, so a save and a check can't trip over each other. */
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn);
    chain = run.catch(() => undefined);
    return run;
  }

  function fail(e: unknown) {
    const kind = e instanceof CloudError ? e.kind : "other";
    const detail = e instanceof Error ? e.message : String(e);
    if (kind === "auth") {
      setState({ status: "error", message: "Your sign-in has expired. Sign in again to keep saving." });
    } else if (kind === "network") {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      setState({
        status: "offline",
        message: offline
          ? "Offline. Changes will save when you're back online."
          : "Can't reach your account right now. Trying again… If this keeps happening, use Test connection.",
      });
    } else {
      setState({ status: "error", message: `Couldn't save: ${detail}` });
    }
    scheduleRetry();
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    const delay = Math.min(30_000, retryBaseMs * 2 ** attempts);
    attempts++;
    const s = session;
    retryTimer = setTimeout(() => void exclusive(() => (needsReconcile ? reconcile(s) : push(s))), delay);
  }

  function succeeded() {
    attempts = 0;
    clearTimeout(retryTimer);
  }

  /** Puts the account's copy into this browser. */
  function pull(uid: string, cloud: Contents, revision: number) {
    writeMeta({ userId: uid, revision, hash: hashContents(cloud) });
    importBackup(cloud, "replace");
    setState({ status: "saved", message: null, conflict: null });
  }

  function askPerson(local: Contents, cloud: Contents, revision: number) {
    clearTimeout(debounceTimer);
    setState({ status: "conflict", message: null, conflict: { cloud, local, revision } });
  }

  /** Reads the account's copy and decides: nothing to do, upload, download, or ask. */
  async function reconcile(s: number, depth = 0): Promise<void> {
    const uid = userId;
    if (!uid || s !== session) return;
    if (needsReconcile) setState({ status: "loading", message: null });

    let row: CloudRow | null;
    try {
      row = await api.fetchRow(uid);
    } catch (e) {
      if (s === session) fail(e);
      return;
    }
    if (s !== session) return;
    needsReconcile = false;
    lastCheckAt = Date.now();
    succeeded();

    const local = normalize(snapshotContents());
    const localHash = hashContents(local);
    const meta = readMeta(uid);

    if (!row) {
      // a brand-new account (or its copy was removed): upload whatever is here
      if (isBlank(local)) {
        writeMeta({ userId: uid, revision: 0, hash: localHash });
        setState({ status: "saved", message: null });
        return;
      }
      writeMeta({ userId: uid, revision: 0, hash: "" });
      return push(s, depth);
    }

    const parsed = parseBackupData(row.data);
    if (!parsed.ok) {
      halted = true;
      setState({
        status: "error",
        message: "The copy saved in your account couldn't be read, so saving is paused to protect it.",
      });
      return;
    }
    const cloud = normalize(parsed.contents);
    const cloudHash = hashContents(cloud);

    if (cloudHash === localHash) {
      writeMeta({ userId: uid, revision: row.revision, hash: cloudHash });
      setState({ status: "saved", message: null });
      return;
    }

    if (!meta) {
      // first time this browser meets this account
      if (isBlank(local)) return pull(uid, cloud, row.revision);
      if (isBlank(cloud)) {
        writeMeta({ userId: uid, revision: row.revision, hash: cloudHash });
        return push(s, depth);
      }
      return askPerson(local, cloud, row.revision);
    }

    const localChanged = meta.hash !== localHash;
    const cloudChanged = meta.revision !== row.revision;
    if (localChanged && cloudChanged) return askPerson(local, cloud, row.revision);
    if (localChanged) {
      writeMeta({ userId: uid, revision: row.revision, hash: meta.hash });
      return push(s, depth);
    }
    pull(uid, cloud, row.revision);
  }

  /** Saves this browser's copy to the account if it differs from what was last saved. */
  async function push(s: number, depth = 0): Promise<void> {
    const uid = userId;
    if (!uid || s !== session || halted || state.conflict) return;
    if (needsReconcile) return reconcile(s);

    for (;;) {
      const contents = normalize(snapshotContents());
      const hash = hashContents(contents);
      const meta = readMeta(uid);
      if (meta?.hash === hash) break;

      setState({ status: "saving", message: null });
      let result: number | "conflict";
      try {
        result =
          !meta || meta.revision === 0
            ? await api.insertRow(uid, backupData(contents))
            : await api.updateRow(uid, backupData(contents), meta.revision);
      } catch (e) {
        if (s === session) fail(e);
        return;
      }
      if (s !== session) return;

      if (result === "conflict") {
        // someone saved first: look at what's there before deciding anything
        if (depth >= 3) return fail(new CloudError("Kept hitting conflicting saves.", "other"));
        return reconcile(s, depth + 1);
      }
      writeMeta({ userId: uid, revision: result, hash });
      succeeded();
    }
    setState({ status: "saved", message: null });
  }

  function isClean(): boolean {
    if (!userId || halted || needsReconcile || state.conflict) return false;
    return readMeta(userId)?.hash === hashContents(normalize(snapshotContents()));
  }

  function onLocalChange() {
    if (!userId || halted || needsReconcile || state.conflict) return; // kept locally, sent once that's settled
    if (isClean()) return;
    setState({ status: "saving", message: null });
    clearTimeout(debounceTimer);
    const s = session;
    debounceTimer = setTimeout(() => void exclusive(() => push(s)), debounceMs);
  }

  function checkForChanges() {
    if (!userId || halted || state.conflict) return;
    if (Date.now() - lastCheckAt < refreshMs) return;
    lastCheckAt = Date.now();
    const s = session;
    void exclusive(() => reconcile(s));
  }

  function retryNow() {
    if (!userId || halted) return;
    clearTimeout(retryTimer);
    const s = session;
    void exclusive(() => (needsReconcile ? reconcile(s) : push(s)));
  }

  function stop() {
    session++;
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
    cleanups.forEach((c) => c());
    cleanups = [];
    userId = null;
    needsReconcile = true;
    halted = false;
    attempts = 0;
    state = OFF;
    listeners.forEach((l) => l());
  }

  function start(uid: string) {
    stop();
    userId = uid;
    const s = session;

    cleanups = [spellBook.subscribe(onLocalChange), bookView.subscribe(onLocalChange), slotTracker.subscribe(onLocalChange)];
    if (typeof window !== "undefined") {
      const onOnline = () => retryNow();
      window.addEventListener("online", onOnline);
      window.addEventListener("focus", checkForChanges);
      cleanups.push(() => window.removeEventListener("online", onOnline), () => window.removeEventListener("focus", checkForChanges));
    }
    if (typeof document !== "undefined") {
      const onVisibility = () => {
        if (document.visibilityState === "visible") return checkForChanges();
        // leaving the page: save right now rather than waiting out the delay
        if (!isClean() && !needsReconcile && !state.conflict) {
          clearTimeout(debounceTimer);
          void exclusive(() => push(s));
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
    }

    setState({ status: "loading", message: null, conflict: null });
    void exclusive(() => reconcile(s));
  }

  /** Saves anything pending now. Resolves true if everything is safely in the account. */
  async function flush(): Promise<boolean> {
    if (!userId) return true;
    clearTimeout(debounceTimer);
    const s = session;
    await exclusive(() => push(s));
    return isClean();
  }

  async function resolveConflict(choice: ConflictChoice): Promise<void> {
    const conflict = state.conflict;
    const uid = userId;
    if (!conflict || !uid) return;
    const s = session;
    return exclusive(async () => {
      if (s !== session) return;
      setState({ conflict: null, status: "saving", message: null });
      const { cloud, revision } = conflict;
      if (choice === "cloud") return pull(uid, cloud, revision);

      // from here on this browser's data is what gets sent, based on the account's current revision
      writeMeta({ userId: uid, revision, hash: hashContents(cloud) });
      if (choice === "merge") importBackup(mergeContents(cloud, normalize(snapshotContents())), "replace");
      return push(s);
    });
  }

  return {
    getState: () => state,
    getServerState: () => OFF,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    start,
    stop,
    flush,
    resolveConflict,
    /** For tests: wait until everything queued so far has finished. */
    idle: () => exclusive(async () => undefined),
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
