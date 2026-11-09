import { SPELL_EFFECT_CODES } from "./spellTags";
import type { Spell } from "./spells";

export type CastingKind = "action" | "bonus" | "reaction";
export type ConcentrationKind = "concentration" | "none";
export type EffectKind = "damage" | "buff" | "debuff" | "healing";

/** Within a group the choices add up (Action or Reaction); between groups they narrow things down. */
export interface BookFilters {
  casting: CastingKind[];
  concentration: ConcentrationKind[];
  effects: EffectKind[];
}

export const NO_FILTERS: BookFilters = { casting: [], concentration: [], effects: [] };

export const CASTING_OPTIONS: { value: CastingKind; label: string }[] = [
  { value: "action", label: "Action" },
  { value: "bonus", label: "Bonus action" },
  { value: "reaction", label: "Reaction" },
];

export const CONCENTRATION_OPTIONS: { value: ConcentrationKind; label: string; hint: string }[] = [
  { value: "concentration", label: "Concentration", hint: "Spells that need you to concentrate" },
  { value: "none", label: "No concentration", hint: "Safe to cast while you're already concentrating" },
];

export const EFFECT_OPTIONS: { value: EffectKind; label: string }[] = [
  { value: "damage", label: "Damage" },
  { value: "buff", label: "Buff" },
  { value: "debuff", label: "Debuff" },
  { value: "healing", label: "Healing" },
];

const CODE_EFFECT: Record<string, EffectKind> = { D: "damage", B: "buff", X: "debuff", H: "healing" };

/** What the casting time lets you do: "Bonus Action, which you take when…" is a bonus action, not an action. */
export function castingKinds(spell: Pick<Spell, "casting_time">): CastingKind[] {
  const time = (spell.casting_time ?? "").toLowerCase();
  const kinds: CastingKind[] = [];
  if (/\bbonus action\b/.test(time)) kinds.push("bonus");
  if (/\breaction\b/.test(time)) kinds.push("reaction");
  if (/\baction\b/.test(time.replace(/\bbonus action\b/g, ""))) kinds.push("action");
  return kinds;
}

// --- sorting spells your own words describe ---------------------------------------------------
// Only for spells that aren't in the 2024 SRD table: custom entries. It reads sentences for tell-tale words,
// so it's a best guess. Official spells never go through it.

const CONDITION =
  /\b(blinded|charmed|deafened|frightened|grappled|incapacitated|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious|exhaustion)\b/i;
/** Sentences like these remove or resist a condition rather than inflict it. */
const RELIEVES =
  /\b(ends?|removes?|cures?|suppress(es)?|negates?)\b[^.]{0,40}\b(condition|curse|effect|disease)\b|\bimmun|\bno longer\b|\bcan'?t be\b|advantage on (saving throws?|saves?)/i;
const DICE = /\b\d+d\d+\b/i;

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);

function inferEffects(spell: Spell): EffectKind[] {
  const found = new Set<EffectKind>();
  const text = [spell.description ?? "", spell.higher_level ?? ""].join(" ");

  if (spell.damage) found.add("damage");
  for (const s of sentences(text)) {
    // damage needs a number: "takes 3d6 Fire damage", "deals 20 damage"; not "if you deal damage, the spell ends"
    if (/\bdamage\b/i.test(s) && (DICE.test(s) || /\b\d+ (\w+ )?damage\b/i.test(s)) && !/\b(resistance|immun|vulnerab)/i.test(s)) {
      found.add("damage");
    }

    if (/\b(regains?|restores?|heals?)\b[^.]{0,120}\bhit points?\b/i.test(s) && !/\b(temporary|can'?t|cannot|unable)\b/i.test(s)) found.add("healing");
    if (/\b(revives?|returns? to life|back to life|becomes? stable)\b/i.test(s)) found.add("healing");
    if (/\b(ends?|removes?|cures?)\b[^.]{0,40}\b(condition|curse|disease|poisoned|blinded|deafened|paralyzed)\b/i.test(s) && !/\b(spell|effect) ends\b/i.test(s)) found.add("healing");

    if (CONDITION.test(s) && !RELIEVES.test(s)) found.add("debuff");
    if (/\bdisadvantage on (its|their|attack|ability|saving|d20|strength)\b/i.test(s) && !/\b(you|your)\b/i.test(s.split(/disadvantage/i)[0])) found.add("debuff");
    if (/\bsubtracts?\b|\bspeed\b[^.]{0,30}\b(reduced|halved|is 0|becomes 0)\b|\bmust (move|drop|flee|follow|use)\b|\bcan'?t (move|speak|take actions?|take reactions?)\b/i.test(s)) found.add("debuff");
    if (/\battack rolls? against (it|them|the (target|creature)s?|those|any)\b[^.]*\badvantage\b/i.test(s)) found.add("debuff");

    if (/\btemporary hit points\b/i.test(s) && !/\btakes?\b/i.test(s)) found.add("buff");
    if (/\bbonus to (ac|armor class|attack|saving|ability|damage|speed)\b|\+\d+ bonus|\bbase ac\b|\b(ac|armor class) (becomes|of|is)\b/i.test(s)) found.add("buff");
    if (/\badds? (\w+ )?(\d+d\d+|your \w+ modifier)\b|\bhit point maximum\b[^.]{0,40}\bincreases?\b/i.test(s)) found.add("buff");
    if (/\badvantage on (attack|ability|d20|dexterity|strength|wisdom|constitution|intelligence|charisma)/i.test(s) || /\b(advantage|\+\d+) on (saving throws|saves)\b/i.test(s)) found.add("buff");
    if (/\bdisadvantage on attack rolls against you\b|\bresistance to\b|\b(gains?|has) an? (fly|swim|climb|burrow) speed\b|\bspeed (increases|is doubled)\b|\b(has|gains) (darkvision|truesight|blindsight)\b/i.test(s)) found.add("buff");
    if (/\b(creature|target|you)[^.]{0,30}\b(has|gains) the invisible condition\b/i.test(s)) found.add("buff");
  }
  return [...found];
}

/** The spell's effects: looked up for official spells, worked out from the text for custom ones. */
export function spellEffects(spell: Spell): EffectKind[] {
  if (!spell.custom && Object.hasOwn(SPELL_EFFECT_CODES, spell.index)) {
    return [...SPELL_EFFECT_CODES[spell.index]].map((c) => CODE_EFFECT[c]);
  }
  return inferEffects(spell);
}

export function matchesFilters(spell: Spell, filters: BookFilters): boolean {
  if (filters.casting.length && !castingKinds(spell).some((k) => filters.casting.includes(k))) return false;
  if (filters.concentration.length && !filters.concentration.includes(spell.concentration ? "concentration" : "none")) return false;
  if (filters.effects.length && !spellEffects(spell).some((e) => filters.effects.includes(e))) return false;
  return true;
}

export const filterSpells = (spells: Spell[], filters: BookFilters): Spell[] =>
  activeFilterCount(filters) === 0 ? spells : spells.filter((s) => matchesFilters(s, filters));

export const activeFilterCount = (f: BookFilters) => f.casting.length + f.concentration.length + f.effects.length;

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
