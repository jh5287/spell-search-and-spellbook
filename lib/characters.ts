import { CLASS_BY_ID } from "./classRules";
import { createLocalStore, type ReadWriteStore } from "./localStore";
import { EMPTY_TRACKER, hasTracker, isTracker, type Tracker } from "./slots";
import { addToBook, isSpellList } from "./spellbook";
import type { Spell } from "./spells";

/** One character's spell book and slot tracker. */
export interface Character {
  id: string;
  name: string;
  spells: Spell[];
  tracker: Tracker;
}

/** Everything that follows you between devices. Which character is open is kept per device instead. */
export interface CharacterList {
  characters: Character[];
}

export const MAX_CHARACTERS = 20;
export const MAX_CHARACTER_NAME = 60;
/** The first character, and what a book from before characters existed becomes. Same id everywhere, so every device agrees. */
export const DEFAULT_CHARACTER_ID = "main";
export const DEFAULT_CHARACTER_NAME = "My character";

export const EMPTY_CHARACTERS: CharacterList = {
  characters: [{ id: DEFAULT_CHARACTER_ID, name: DEFAULT_CHARACTER_NAME, spells: [], tracker: EMPTY_TRACKER }],
};

function isCharacter(v: unknown): v is Character {
  const c = v as Partial<Character> | null;
  return (
    typeof c === "object" &&
    c !== null &&
    typeof c.id === "string" &&
    c.id.length > 0 &&
    c.id.length <= 64 &&
    typeof c.name === "string" &&
    c.name.length > 0 &&
    c.name.length <= MAX_CHARACTER_NAME &&
    isSpellList(c.spells) &&
    isTracker(c.tracker)
  );
}

export function isCharacters(v: unknown): v is Character[] {
  return (
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= MAX_CHARACTERS &&
    v.every(isCharacter) &&
    new Set(v.map((c: Character) => c.id)).size === v.length
  );
}

export const isCharacterList = (v: unknown): v is CharacterList =>
  typeof v === "object" && v !== null && isCharacters((v as Partial<CharacterList>).characters);

// --- storage ---------------------------------------------------------------------------------

const LEGACY_SPELLS = "spellbook:spells";
const LEGACY_SLOTS = "spellbook:slots";

/** Before characters, the book and the tracker were each saved on their own. The first time, fold them into one character. */
function migrateLegacy(): { value: CharacterList; done: () => void } | undefined {
  const read = (key: string): unknown => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return undefined;
    }
  };
  const spells = read(LEGACY_SPELLS);
  const tracker = read(LEGACY_SLOTS);
  if (spells === undefined && tracker === undefined) return undefined;

  return {
    value: {
      characters: [
        {
          id: DEFAULT_CHARACTER_ID,
          name: DEFAULT_CHARACTER_NAME,
          spells: isSpellList(spells) ? spells : [],
          tracker: isTracker(tracker) ? tracker : EMPTY_TRACKER,
        },
      ],
    },
    done: () => {
      localStorage.removeItem(LEGACY_SPELLS);
      localStorage.removeItem(LEGACY_SLOTS);
    },
  };
}

export const characterBook = createLocalStore<CharacterList>("spellbook:characters", EMPTY_CHARACTERS, isCharacterList, {
  migrate: migrateLegacy,
});

/** Which character this browser has open. Not synced: switching on your phone shouldn't switch your desktop. */
export const activeCharacterId = createLocalStore<string>(
  "spellbook:active-character",
  DEFAULT_CHARACTER_ID,
  (v): v is string => typeof v === "string",
);

/** The open character, or the first one if the saved choice no longer exists (say, it was deleted on another device). */
export function resolveActive(list: CharacterList, activeId: string): Character {
  return list.characters.find((c) => c.id === activeId) ?? list.characters[0];
}

/** A view of one part of the open character that behaves like a store of its own, so the rest of the app doesn't need to know. */
function viewOfActive<T>(initial: T, pick: (c: Character) => T, put: (c: Character, value: T) => Character): ReadWriteStore<T> {
  const active = (list: CharacterList) => resolveActive(list, activeCharacterId.getSnapshot());
  return {
    getSnapshot: () => pick(active(characterBook.getSnapshot())),
    getServerSnapshot: () => initial,
    subscribe(listener) {
      const stops = [characterBook.subscribe(listener), activeCharacterId.subscribe(listener)];
      return () => stops.forEach((stop) => stop());
    },
    set(next) {
      characterBook.set((list) => {
        const open = active(list);
        const value = typeof next === "function" ? (next as (prev: T) => T)(pick(open)) : next;
        return { characters: list.characters.map((c) => (c.id === open.id ? put(c, value) : c)) };
      });
    },
  };
}

/** The open character's spells, in their order (new spells go to the end of their level). */
export const spellBook = viewOfActive<Spell[]>([], (c) => c.spells, (c, spells) => ({ ...c, spells }));

/** The open character's slots and abilities. */
export const slotTracker = viewOfActive<Tracker>(EMPTY_TRACKER, (c) => c.tracker, (c, tracker) => ({ ...c, tracker }));

// --- changes to the list (pure) --------------------------------------------------------------

export function newCharacterId(): string {
  return `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cleanName(name: string, fallback = DEFAULT_CHARACTER_NAME): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_CHARACTER_NAME) || fallback;
}

/** "Aria" becomes "Aria 2" if there's already an Aria. `ignoreId` is the character being renamed. */
export function uniqueName(list: CharacterList, wanted: string, ignoreId?: string): string {
  const base = cleanName(wanted);
  const taken = new Set(list.characters.filter((c) => c.id !== ignoreId).map((c) => c.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = base.slice(0, MAX_CHARACTER_NAME - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function addCharacter(list: CharacterList, id: string, name: string, source?: Character): CharacterList {
  if (list.characters.length >= MAX_CHARACTERS) return list;
  const copy: { spells: Spell[]; tracker: Tracker } = source
    ? JSON.parse(JSON.stringify({ spells: source.spells, tracker: source.tracker }))
    : { spells: [], tracker: EMPTY_TRACKER };
  return { characters: [...list.characters, { id, name: uniqueName(list, name), ...copy }] };
}

export function renameCharacter(list: CharacterList, id: string, name: string): CharacterList {
  return { characters: list.characters.map((c) => (c.id === id ? { ...c, name: uniqueName(list, name, id) } : c)) };
}

/** The last character can't be deleted: there's always one to work in. */
export function deleteCharacter(list: CharacterList, id: string): CharacterList {
  return list.characters.length <= 1 ? list : { characters: list.characters.filter((c) => c.id !== id) };
}

/** Brings in characters from a backup or account: the same character (by id) gets the spells it lacks, new ones are added. */
export function mergeCharacters(existing: Character[], incoming: Character[]): Character[] {
  const result = [...existing];
  for (const inc of incoming) {
    const at = result.findIndex((c) => c.id === inc.id);
    if (at >= 0) {
      const cur = result[at];
      result[at] = {
        ...cur,
        spells: inc.spells.reduce(addToBook, cur.spells),
        tracker: hasTracker(cur.tracker) ? cur.tracker : inc.tracker,
      };
    } else if (result.length < MAX_CHARACTERS) {
      result.push(inc);
    }
  }
  return result;
}

/** "Wizard 5 / Cleric 2" from what was set up on the Slots tab. */
export function classLine(c: Character): string {
  return c.tracker.classes.map((e) => `${CLASS_BY_ID[e.classId].name} ${e.level}`).join(" / ");
}

/** True for a brand-new, untouched book: nothing in it worth asking about when it meets an account. */
export function isUntouched(characters: Character[]): boolean {
  const [only] = characters;
  return characters.length === 1 && only.name === DEFAULT_CHARACTER_NAME && only.spells.length === 0 && !hasTracker(only.tracker);
}

// --- actions on the stores -------------------------------------------------------------------

export function switchCharacter(id: string) {
  activeCharacterId.set(id);
}

/** Adds a character (blank, or a copy of `source`) and opens it. */
export function createCharacter(name: string, source?: Character): string {
  const id = newCharacterId();
  characterBook.set((list) => addCharacter(list, id, name, source));
  if (characterBook.getSnapshot().characters.some((c) => c.id === id)) activeCharacterId.set(id);
  return id;
}

/** Deletes a character; if it was the open one, opens its neighbour. */
export function removeCharacter(id: string) {
  const before = characterBook.getSnapshot().characters;
  if (before.length <= 1) return;
  const at = before.findIndex((c) => c.id === id);
  const open = resolveActive({ characters: before }, activeCharacterId.getSnapshot()).id;
  characterBook.set((list) => deleteCharacter(list, id));
  if (open === id) activeCharacterId.set(before[at + 1]?.id ?? before[at - 1].id);
}
