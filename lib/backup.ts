import { appearance } from "./appearanceStore";
import {
  DEFAULT_CHARACTER_ID,
  DEFAULT_CHARACTER_NAME,
  activeCharacterId,
  characterBook,
  isCharacters,
  mergeCharacters,
  resolveActive,
  type Character,
} from "./characters";
import { EMPTY_TRACKER, isTracker } from "./slots";
import { addToBook, bookView, isBookView, isSpellList, type BookView } from "./spellbook";

const BACKUP_APP = "spell-book";
/** 1: one spell book and one slot tracker. 2: any number of characters, each with their own. */
const BACKUP_VERSION = 2;
/** Browsers keep roughly 5 MB per site, so a bigger file can't be a real backup. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** What a backup file holds. Each part is optional so partial files still import. */
export interface BackupContents {
  characters?: Character[];
  view?: BookView;
}

export type ParseResult = { ok: true; contents: BackupContents; exportedAt?: string } | { ok: false; error: string };
export type ImportMode = "merge" | "replace";

/** Everything saved in this browser right now. */
export function snapshotContents(): Required<BackupContents> {
  return { characters: characterBook.getSnapshot().characters, view: bookView.getSnapshot() };
}

/** The JSON-ready object for a backup file, or for the copy kept in a signed-in account. */
export function backupData(contents: BackupContents, exportedAt = new Date().toISOString()) {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, ...contents };
}

export function createBackup(): string {
  return JSON.stringify(backupData(snapshotContents()), null, 2);
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
  return parseBackupData(data);
}

const dedupe = (c: Character): Character => ({ ...c, spells: c.spells.reduce(addToBook, []) });

/** Checks parsed JSON from a backup file or an account and keeps only the parts that are valid. */
export function parseBackupData(data: unknown): ParseResult {
  const file = data as Record<string, unknown> | null;
  if (typeof file !== "object" || file === null || file.app !== BACKUP_APP) {
    return { ok: false, error: "That doesn't look like a Spell Book backup." };
  }
  if (typeof file.version !== "number" || file.version > BACKUP_VERSION) {
    return { ok: false, error: "That backup was made by a newer version of the app and can't be read yet." };
  }

  const contents: BackupContents = {};
  if (file.version >= 2) {
    if (file.characters !== undefined) {
      if (!isCharacters(file.characters)) return { ok: false, error: "The characters in that file are damaged or in an unknown format." };
      contents.characters = file.characters.map(dedupe);
    }
  } else {
    // from before characters: one book and one tracker become the first character
    if (file.spells !== undefined && !isSpellList(file.spells)) return { ok: false, error: "The spells in that file are damaged or in an unknown format." };
    if (file.tracker !== undefined && !isTracker(file.tracker)) return { ok: false, error: "The slot tracker in that file is damaged or in an unknown format." };
    if (file.spells !== undefined || file.tracker !== undefined) {
      contents.characters = [
        {
          id: DEFAULT_CHARACTER_ID,
          name: DEFAULT_CHARACTER_NAME,
          spells: (file.spells as Character["spells"] | undefined)?.reduce(addToBook, []) ?? [],
          tracker: (file.tracker as Character["tracker"] | undefined) ?? EMPTY_TRACKER,
        },
      ];
    }
  }
  if (file.view !== undefined && isBookView(file.view)) contents.view = file.view;
  if (!contents.characters) return { ok: false, error: "That backup has no characters, spells or slot tracker in it." };

  return { ok: true, contents, exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : undefined };
}

/** How many of the file's spells aren't in your characters yet. */
export function countNewSpells(contents: BackupContents): number {
  const mine = new Map(characterBook.getSnapshot().characters.map((c) => [c.id, new Set(c.spells.map((s) => s.index))]));
  return (contents.characters ?? []).reduce((total, c) => {
    const have = mine.get(c.id);
    return total + (have ? c.spells.filter((s) => !have.has(s.index)).length : c.spells.length);
  }, 0);
}

/**
 * "merge" adds characters you don't have, and gives ones you do have (matched by id) the spells they're missing;
 * a slot tracker only comes across if that character has none. "replace" swaps in the file's characters.
 */
export function importBackup({ characters, view }: BackupContents, mode: ImportMode) {
  if (characters) {
    characterBook.set((list) => ({ characters: mode === "replace" ? characters : mergeCharacters(list.characters, characters) }));
    // keep the open character if it survived; otherwise open the first
    const open = resolveActive(characterBook.getSnapshot(), activeCharacterId.getSnapshot()).id;
    if (open !== activeCharacterId.getSnapshot()) activeCharacterId.set(open);
  }
  if (view && mode === "replace") bookView.set(view);
}

/** Hard reset: wipes every character, the display style and appearance, leaving a blank slate. */
export function eraseEverything() {
  characterBook.clear();
  activeCharacterId.clear();
  bookView.clear();
  appearance.clear();
}
