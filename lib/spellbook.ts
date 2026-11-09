import { createLocalStore } from "./localStore";
import { ordinal, type Spell } from "./spells";

export type BookView = "full" | "compact" | "list";

export const BOOK_VIEWS: { value: BookView; label: string }[] = [
  { value: "full", label: "Full" },
  { value: "compact", label: "Compact" },
  { value: "list", label: "List" },
];

function isSpell(v: unknown): v is Spell {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Partial<Spell>;
  return (
    typeof s.index === "string" &&
    typeof s.name === "string" &&
    typeof s.level === "number" &&
    typeof s.school?.name === "string" &&
    typeof s.description === "string" &&
    Array.isArray(s.components) &&
    Array.isArray(s.classes) &&
    (s.kind === undefined || typeof s.kind === "string")
  );
}

export const isSpellList = (v: unknown): v is Spell[] => Array.isArray(v) && v.every(isSpell);
export const isBookView = (v: unknown): v is BookView => BOOK_VIEWS.some((o) => o.value === v);

/** Saved spells, in the user's order (new spells go to the end of their level). */
export const spellBook = createLocalStore<Spell[]>("spellbook:spells", [], isSpellList);

export const bookView = createLocalStore<BookView>("spellbook:view", "full", isBookView);

/** Whether the filter chips above the book are showing. Remembered, so it stays how you like it. */
export const filtersOpen = createLocalStore<boolean>("spellbook:filters-open", false, (v): v is boolean => typeof v === "boolean");

export function addToBook(spells: Spell[], spell: Spell): Spell[] {
  return spells.some((s) => s.index === spell.index) ? spells : [...spells, spell];
}

export function removeFromBook(spells: Spell[], index: string): Spell[] {
  return spells.filter((s) => s.index !== index);
}

/** Moves `activeId` to where `overId` is, shuffling only the spells in that group. */
export function reorderWithinGroup(
  spells: Spell[],
  key: string,
  activeId: string,
  overId: string,
): Spell[] {
  const slots = spells.flatMap((s, i) => (groupKey(s) === key ? [i] : []));
  const group = slots.map((i) => spells[i]);
  const from = group.findIndex((s) => s.index === activeId);
  const to = group.findIndex((s) => s.index === overId);
  if (from < 0 || to < 0 || from === to) return spells;

  const moved = [...group];
  moved.splice(to, 0, ...moved.splice(from, 1));
  const next = [...spells];
  slots.forEach((slot, k) => {
    next[slot] = moved[k];
  });
  return next;
}

export interface SpellGroup {
  key: string;
  heading: string;
  spells: Spell[];
}

/** Spells share a group by level; custom non-spell entries share one by their kind. */
export function groupKey(spell: Spell): string {
  return spell.kind ? `kind:${spell.kind.toLowerCase()}` : `level:${spell.level}`;
}

/** Cantrips first, then level 1, 2, …, then other kinds A–Z; saved order is kept within a group. */
export function groupSpells(spells: Spell[]): SpellGroup[] {
  const groups = new Map<string, SpellGroup>();
  for (const spell of spells) {
    const key = groupKey(spell);
    const group = groups.get(key) ?? { key, heading: spell.kind ?? levelHeading(spell.level), spells: [] };
    group.spells.push(spell);
    groups.set(key, group);
  }
  const isLevel = (g: SpellGroup) => g.key.startsWith("level:");
  return [...groups.values()].sort((a, b) => {
    if (isLevel(a) !== isLevel(b)) return isLevel(a) ? -1 : 1;
    return isLevel(a) ? a.spells[0].level - b.spells[0].level : a.heading.localeCompare(b.heading);
  });
}

export function levelHeading(level: number): string {
  return level === 0 ? "Cantrips" : `${ordinal(level)} Level`;
}

/** Swaps in an edited entry. It keeps its place, unless it moved to a different section: then it goes to the end of that one. */
export function replaceInBook(spells: Spell[], updated: Spell): Spell[] {
  const old = spells.find((s) => s.index === updated.index);
  if (!old) return spells;
  if (groupKey(old) !== groupKey(updated)) return [...spells.filter((s) => s !== old), updated];
  return spells.map((s) => (s === old ? updated : s));
}
