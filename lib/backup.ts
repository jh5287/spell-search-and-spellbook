import { hasTracker, isTracker, slotTracker, type Tracker } from "./slots";
import { addToBook, bookView, isBookView, isSpellList, spellBook, type BookView } from "./spellbook";
import type { Spell } from "./spells";

const BACKUP_APP = "spell-book";
const BACKUP_VERSION = 1;
/** Browsers keep roughly 5 MB per site, so a bigger file can't be a real backup. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** What a backup file holds. Each part is optional so older or partial files still import. */
export interface BackupContents {
  spells?: Spell[];
  view?: BookView;
  tracker?: Tracker;
}

export type ParseResult = { ok: true; contents: BackupContents; exportedAt?: string } | { ok: false; error: string };
export type ImportMode = "merge" | "replace";

export function createBackup(): string {
  return JSON.stringify(
    {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      spells: spellBook.getSnapshot(),
      view: bookView.getSnapshot(),
      tracker: slotTracker.getSnapshot(),
    },
    null,
    2,
  );
}

export function backupFilename(date = new Date()): string {
  return `spell-book-backup-${date.toISOString().slice(0, 10)}.json`;
}

/** Hands the backup to the browser as a file download. */
export function downloadBackup() {
  const url = URL.createObjectURL(new Blob([createBackup()], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFilename();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON. Choose a backup exported from this app." };
  }

  const file = data as Record<string, unknown> | null;
  if (typeof file !== "object" || file === null || file.app !== BACKUP_APP) {
    return { ok: false, error: "That doesn't look like a Spell Book backup." };
  }
  if (typeof file.version !== "number" || file.version > BACKUP_VERSION) {
    return { ok: false, error: "That backup was made by a newer version of the app and can't be read yet." };
  }

  const contents: BackupContents = {};
  if (file.spells !== undefined) {
    if (!isSpellList(file.spells)) return { ok: false, error: "The spells in that file are damaged or in an unknown format." };
    contents.spells = file.spells.reduce(addToBook, []);
  }
  if (file.view !== undefined && isBookView(file.view)) contents.view = file.view;
  if (file.tracker !== undefined) {
    if (!isTracker(file.tracker)) return { ok: false, error: "The slot tracker in that file is damaged or in an unknown format." };
    contents.tracker = file.tracker;
  }
  if (!contents.spells && !contents.tracker) return { ok: false, error: "That backup has no spells or slot tracker in it." };

  return { ok: true, contents, exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : undefined };
}

/** How many of the file's spells aren't in the book yet. */
export function countNewSpells(contents: BackupContents): number {
  const have = new Set(spellBook.getSnapshot().map((s) => s.index));
  return (contents.spells ?? []).filter((s) => !have.has(s.index)).length;
}

/**
 * "merge" adds spells that aren't in the book yet and only brings in the slot tracker if there isn't
 * one already. "replace" overwrites whichever parts the file contains.
 */
export function importBackup({ spells, view, tracker }: BackupContents, mode: ImportMode) {
  if (mode === "replace") {
    if (spells) spellBook.set(spells);
    if (view) bookView.set(view);
    if (tracker) slotTracker.set(tracker);
    return;
  }
  if (spells) spellBook.set((prev) => spells.reduce(addToBook, prev));
  if (tracker && !hasTracker(slotTracker.getSnapshot())) slotTracker.set(tracker);
}
