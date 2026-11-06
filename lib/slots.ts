import {
  clampLevel,
  isClassId,
  planAbilities,
  planSlots,
  subclassOf,
  CLASS_BY_ID,
  type ClassEntry,
  type Mods,
  type Recharge,
} from "./classRules";
import { createLocalStore } from "./localStore";
import { ordinal, type Spell } from "./spells";

/** A spell cast from a slot, kept on the slot so you can see where each one went. */
export interface Cast {
  id: string;
  name: string;
  /** The spell's own level, so a higher slot level shows as an upcast. */
  level: number;
}

export interface SlotRow {
  /** Spell level 1–9. */
  level: number;
  max: number;
  used: number;
  /** Spells cast from this slot level since the last rest; never longer than `used`. */
  casts?: Cast[];
}

export interface Ability {
  id: string;
  name: string;
  /** e.g. "Cleric · Life Domain"; blank for abilities the user added. */
  source?: string;
  max: number;
  used: number;
  recharge: Recharge;
  /** Show a number box instead of a row of pips, for big pools. */
  counter?: boolean;
  note?: string;
}

export interface Tracker {
  /** What the slots and abilities were generated from, so the setup form can be reopened. */
  classes: ClassEntry[];
  mods: Mods;
  slots: SlotRow[];
  /** Warlock Pact Magic slots: all one level, back on a short rest. */
  pact: SlotRow | null;
  abilities: Ability[];
}

export const MAX_COUNT = 999;
export const MAX_NAME = 60;
export const MAX_NOTE = 200;
export const DEFAULT_MODS: Mods = { wis: 3, cha: 3 };

export const EMPTY_TRACKER: Tracker = { classes: [], mods: DEFAULT_MODS, slots: [], pact: null, abilities: [] };

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_COUNT;
const isMod = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= -5 && (n as number) <= 10;
const RECHARGES: Recharge[] = ["short", "shortOne", "long", "manual"];

function isCast(v: unknown): v is Cast {
  const c = v as Partial<Cast> | null;
  return (
    typeof c === "object" &&
    c !== null &&
    typeof c.id === "string" &&
    c.id.length <= 100 &&
    typeof c.name === "string" &&
    c.name.length <= 100 &&
    Number.isInteger(c.level) &&
    c.level! >= 0 &&
    c.level! <= 9
  );
}

function isSlotRow(v: unknown): v is SlotRow {
  const r = v as Partial<SlotRow> | null;
  return (
    typeof r === "object" &&
    r !== null &&
    Number.isInteger(r.level) &&
    r.level! >= 1 &&
    r.level! <= 9 &&
    isCount(r.max) &&
    isCount(r.used) &&
    (r.casts === undefined || (Array.isArray(r.casts) && r.casts.length <= MAX_COUNT && r.casts.every(isCast)))
  );
}

function isAbility(v: unknown): v is Ability {
  const a = v as Partial<Ability> | null;
  return (
    typeof a === "object" &&
    a !== null &&
    typeof a.id === "string" &&
    a.id.length <= 100 &&
    typeof a.name === "string" &&
    a.name.length <= MAX_NAME &&
    (a.source === undefined || (typeof a.source === "string" && a.source.length <= 100)) &&
    isCount(a.max) &&
    isCount(a.used) &&
    RECHARGES.includes(a.recharge as Recharge) &&
    (a.counter === undefined || typeof a.counter === "boolean") &&
    (a.note === undefined || (typeof a.note === "string" && a.note.length <= MAX_NOTE))
  );
}

function isClassEntry(v: unknown): v is ClassEntry {
  const e = v as Partial<ClassEntry> | null;
  return (
    typeof e === "object" &&
    e !== null &&
    isClassId(e.classId) &&
    Number.isInteger(e.level) &&
    e.level! >= 1 &&
    e.level! <= 20 &&
    (e.subclassId === undefined || CLASS_BY_ID[e.classId].subclasses.some((s) => s.id === e.subclassId))
  );
}

export function isTracker(v: unknown): v is Tracker {
  const t = v as Partial<Tracker> | null;
  return (
    typeof t === "object" &&
    t !== null &&
    Array.isArray(t.classes) &&
    t.classes.length <= 12 &&
    t.classes.every(isClassEntry) &&
    typeof t.mods === "object" &&
    t.mods !== null &&
    isMod(t.mods.wis) &&
    isMod(t.mods.cha) &&
    Array.isArray(t.slots) &&
    t.slots.length <= 9 &&
    t.slots.every(isSlotRow) &&
    (t.pact === null || isSlotRow(t.pact)) &&
    Array.isArray(t.abilities) &&
    t.abilities.length <= 200 &&
    t.abilities.every(isAbility)
  );
}

export const slotTracker = createLocalStore<Tracker>("spellbook:slots", EMPTY_TRACKER, isTracker);

export function hasTracker(t: Tracker): boolean {
  return t.classes.length > 0 || t.slots.length > 0 || t.pact !== null || t.abilities.length > 0;
}

const clampCount = (n: number) => Math.min(MAX_COUNT, Math.max(0, Math.trunc(n) || 0));
const keepUsed = (used: number, max: number) => Math.min(used, max);

/** Returns the row with new counts, clamped, and forgets casts that no longer have a spent slot behind them. */
function resized(row: SlotRow, patch: { max?: number; used?: number; level?: number }): SlotRow {
  const max = patch.max === undefined ? row.max : clampCount(patch.max);
  const used = Math.min(max, patch.used === undefined ? row.used : clampCount(patch.used));
  const { casts, ...rest } = row;
  const kept = casts?.slice(0, used);
  return { ...rest, level: patch.level ?? row.level, max, used, ...(kept?.length ? { casts: kept } : {}) };
}

/** A fresh row with nothing spent and no casts, as after a rest. */
const rested = (row: SlotRow): SlotRow => resized(row, { used: 0 });
const cleanMod = (n: number, fallback: number) => (Number.isFinite(n) ? Math.min(10, Math.max(-5, Math.trunc(n))) : fallback);

export function isCustomId(id: string): boolean {
  return id.startsWith("custom:");
}

export function newAbilityId(): string {
  return `custom:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Rebuilds the slots and class abilities from the rules. Spent counts carry over where the same
 * slot or ability still exists, and abilities the user added themselves are kept.
 */
export function applyClasses(t: Tracker, classes: ClassEntry[], rawMods: Mods): Tracker {
  const mods: Mods = { wis: cleanMod(rawMods.wis, DEFAULT_MODS.wis), cha: cleanMod(rawMods.cha, DEFAULT_MODS.cha) };
  const entries = classes.map((e) => ({
    ...e,
    level: clampLevel(e.level),
    subclassId: subclassOf(e) ? e.subclassId : undefined,
  }));
  const plan = planSlots(entries);

  const slots: SlotRow[] = plan.slots.flatMap((max, i) => {
    if (max === 0) return [];
    const old = t.slots.find((s) => s.level === i + 1);
    return [resized({ ...old, level: i + 1, max, used: old?.used ?? 0 }, { max })];
  });
  const pact: SlotRow | null = plan.pact
    ? resized({ ...t.pact, level: plan.pact.level, max: plan.pact.count, used: t.pact?.used ?? 0 }, { max: plan.pact.count })
    : null;

  const abilities: Ability[] = planAbilities(entries, mods).map((p) => {
    const old = t.abilities.find((a) => a.id === p.id);
    return { ...p, used: keepUsed(old?.used ?? 0, p.max) };
  });

  return {
    classes: entries,
    mods,
    slots,
    pact,
    abilities: [...abilities, ...t.abilities.filter((a) => isCustomId(a.id))],
  };
}

export function setSlotUsed(t: Tracker, level: number, used: number): Tracker {
  return { ...t, slots: t.slots.map((s) => (s.level === level ? resized(s, { used }) : s)) };
}

export function setSlotMax(t: Tracker, level: number, max: number): Tracker {
  return { ...t, slots: t.slots.map((s) => (s.level === level ? resized(s, { max }) : s)) };
}

export function addSlotLevel(t: Tracker, level: number): Tracker {
  if (t.slots.some((s) => s.level === level)) return t;
  return { ...t, slots: [...t.slots, { level, max: 1, used: 0 }].sort((a, b) => a.level - b.level) };
}

export function removeSlotLevel(t: Tracker, level: number): Tracker {
  return { ...t, slots: t.slots.filter((s) => s.level !== level) };
}

export function updatePact(t: Tracker, patch: Partial<Pick<SlotRow, "level" | "max" | "used">>): Tracker {
  if (!t.pact) return t;
  const level = patch.level === undefined ? undefined : Math.min(9, Math.max(1, Math.trunc(patch.level) || 1));
  return { ...t, pact: resized(t.pact, { max: patch.max, used: patch.used, level }) };
}

export function setPact(t: Tracker, pact: SlotRow | null): Tracker {
  return { ...t, pact };
}

export function updateAbility(
  t: Tracker,
  id: string,
  patch: Partial<Pick<Ability, "name" | "max" | "used" | "recharge" | "counter">>,
): Tracker {
  return {
    ...t,
    abilities: t.abilities.map((a) => {
      if (a.id !== id) return a;
      const max = patch.max === undefined ? a.max : clampCount(patch.max);
      const used = patch.used === undefined ? a.used : clampCount(patch.used);
      return { ...a, ...patch, name: (patch.name ?? a.name).slice(0, MAX_NAME), max, used: Math.min(used, max) };
    }),
  };
}

export function addAbility(t: Tracker, ability: Omit<Ability, "id" | "used">): Tracker {
  const max = clampCount(ability.max);
  return {
    ...t,
    abilities: [
      ...t.abilities,
      { ...ability, id: newAbilityId(), name: ability.name.trim().slice(0, MAX_NAME), max, used: 0 },
    ],
  };
}

export function removeAbility(t: Tracker, id: string): Tracker {
  return { ...t, abilities: t.abilities.filter((a) => a.id !== id) };
}

/** Everything comes back, except abilities set to "manual only". */
export function longRest(t: Tracker): Tracker {
  return {
    ...t,
    slots: t.slots.map(rested),
    pact: t.pact && rested(t.pact),
    abilities: t.abilities.map((a) => (a.recharge === "manual" ? a : { ...a, used: 0 })),
  };
}

/** Pact Magic slots and "short rest" abilities come back; "1 on short rest" abilities regain a single use. */
export function shortRest(t: Tracker): Tracker {
  return {
    ...t,
    pact: t.pact && rested(t.pact),
    abilities: t.abilities.map((a) =>
      a.recharge === "short"
        ? { ...a, used: 0 }
        : a.recharge === "shortOne"
          ? { ...a, used: Math.max(0, a.used - 1) }
          : a,
    ),
  };
}

// --- casting ---------------------------------------------------------------------------------

/** Which slots a cast spends from: a spell-level slot, or the Warlock's Pact Magic slots. */
export type SlotTarget = { kind: "slot"; level: number } | { kind: "pact" };

export interface CastOption {
  /** "1"–"9" for a spell-level slot, "pact" for Pact Magic. */
  value: string;
  label: string;
  target: SlotTarget;
  /** Slot level the spell would be cast at. */
  level: number;
  left: number;
}

/** Cantrips and non-spell entries (abilities, items) don't use slots. */
export function isCastable(spell: Pick<Spell, "level" | "kind">): boolean {
  return !spell.kind && spell.level >= 1;
}

export function targetRow(t: Tracker, target: SlotTarget): SlotRow | null {
  return target.kind === "pact" ? t.pact : (t.slots.find((s) => s.level === target.level) ?? null);
}

export function slotLabel(target: SlotTarget, level: number): string {
  return target.kind === "pact" ? `Pact Magic slot (${ordinal(level)} level)` : `${ordinal(level)}-level slot`;
}

/** Slots a spell of this level can be cast with: its own level and higher (upcasting), Pact Magic last. */
export function castOptions(t: Tracker, spellLevel: number): CastOption[] {
  const options: CastOption[] = t.slots
    .filter((s) => s.level >= spellLevel && s.max > 0)
    .map((s) => ({
      value: String(s.level),
      label: `${ordinal(s.level)} level`,
      target: { kind: "slot", level: s.level },
      level: s.level,
      left: Math.max(0, s.max - s.used),
    }));
  if (t.pact && t.pact.level >= spellLevel && t.pact.max > 0) {
    options.push({
      value: "pact",
      label: `Pact Magic (${ordinal(t.pact.level)})`,
      target: { kind: "pact" },
      level: t.pact.level,
      left: Math.max(0, t.pact.max - t.pact.used),
    });
  }
  return options;
}

/** The spell's own level if there's a slot for it; otherwise the first slot that can cast it. */
export function defaultCastOption(options: CastOption[], spellLevel: number): CastOption | undefined {
  return options.find((o) => o.value === String(spellLevel)) ?? options.find((o) => o.left > 0) ?? options[0];
}

export function newCastId(): string {
  return `cast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Spends one slot and remembers which spell it went to. Does nothing if none are left. */
export function recordCast(t: Tracker, target: SlotTarget, cast: Cast): Tracker {
  const row = targetRow(t, target);
  if (!row || row.used >= row.max) return t;
  const next: SlotRow = { ...row, used: row.used + 1, casts: [...(row.casts ?? []), cast].slice(-(row.used + 1)) };
  return target.kind === "pact"
    ? { ...t, pact: next }
    : { ...t, slots: t.slots.map((s) => (s === row ? next : s)) };
}

/** Gives the slot back and forgets the cast. Does nothing if a rest or edit already cleared it. */
export function undoCast(t: Tracker, castId: string): Tracker {
  const undo = (row: SlotRow): SlotRow => {
    if (!row.casts?.some((c) => c.id === castId)) return row;
    const casts = row.casts.filter((c) => c.id !== castId);
    return { ...row, used: Math.max(0, row.used - 1), casts: casts.length ? casts : undefined };
  };
  return { ...t, slots: t.slots.map(undo), pact: t.pact && undo(t.pact) };
}
