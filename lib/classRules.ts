/**
 * 2024 Player's Handbook class data used to pre-fill the slot and ability trackers.
 * Tables were checked against the D&D 5e 2024 SRD API and the 2024 PHB text. Where the API
 * disagreed with the book (Wizard prepared spells, Druid cantrips) the book wins.
 */

/** short: all back on a short or long rest · shortOne: one back on a short rest, all on a long rest */
export type Recharge = "short" | "shortOne" | "long" | "manual";
export type ModName = "wis" | "cha";
export type Mods = Record<ModName, number>;

export const RECHARGE_LABELS: Record<Recharge, string> = {
  short: "Short or long rest",
  shortOne: "1 on short rest, all on long rest",
  long: "Long rest",
  manual: "Manual only",
};

export interface Feature {
  name: string;
  /** Class (or subclass) level range the feature is tracked for. */
  from?: number;
  to?: number;
  uses: (level: number, mods: Mods) => number;
  /** Set when `uses` depends on this ability modifier, so the setup form can ask for it. */
  mod?: ModName;
  recharge: Recharge;
  /** Large pools (hit points, points) are tracked with a number rather than a row of pips. */
  counter?: boolean;
  note?: string;
}

export interface SubclassRules {
  id: string;
  name: string;
  /** Eldritch Knight / Arcane Trickster cast with the one-third caster table. */
  caster?: "third";
  features: Feature[];
}

export type ClassId =
  | "barbarian"
  | "bard"
  | "cleric"
  | "druid"
  | "fighter"
  | "monk"
  | "paladin"
  | "ranger"
  | "rogue"
  | "sorcerer"
  | "warlock"
  | "wizard";

export type CasterKind = "full" | "half" | "third" | "pact";

export interface ClassRules {
  id: ClassId;
  name: string;
  caster?: Exclude<CasterKind, "third">;
  cantrips?: (level: number) => number;
  prepared?: (level: number) => number;
  features: Feature[];
  subclasses: SubclassRules[];
}

/** Picks the value of the last [level, value] step at or below `level`. */
const steps =
  (...table: [level: number, value: number][]) =>
  (level: number) =>
    table.reduce((value, [from, v]) => (level >= from ? v : value), 0);

const fixed = (n: number) => () => n;
const byMod = (mod: ModName) => (_level: number, mods: Mods) => Math.max(1, mods[mod]);

const once = (name: string, recharge: Recharge, from: number, note?: string): Feature => ({
  name,
  from,
  uses: fixed(1),
  recharge,
  note,
});

const modUses = (name: string, mod: ModName, from: number, extra: Partial<Feature> = {}): Feature => ({
  name,
  from,
  uses: byMod(mod),
  mod,
  recharge: "long",
  ...extra,
});

const byTable = (table: number[]) => (level: number) => table[level - 1] ?? 0;

// Prepared spells by level 1–20
const PREPARED_STANDARD = byTable([4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]);
const PREPARED_WIZARD = byTable([4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25]);
const PREPARED_HALF = byTable([2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]);
const PREPARED_SORCERER = byTable([2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]);
const PREPARED_WARLOCK = byTable([2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]);
// Eldritch Knight and Arcane Trickster, levels 3–20
const PREPARED_THIRD = (level: number) =>
  [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13][level - 3] ?? 0;

const CANTRIPS_3 = steps([1, 3], [4, 4], [10, 5]);
const CANTRIPS_2 = steps([1, 2], [4, 3], [10, 4]);

export const CLASSES: ClassRules[] = [
  {
    id: "barbarian",
    name: "Barbarian",
    features: [
      {
        name: "Rage",
        uses: steps([1, 2], [3, 3], [6, 4], [12, 5], [17, 6]),
        recharge: "shortOne",
        note: "Rage damage +2, +3 at level 9, +4 at level 16.",
      },
      once("Persistent Rage", "long", 15, "On initiative, regain all expended Rage uses."),
    ],
    subclasses: [
      { id: "berserker", name: "Path of the Berserker", features: [once("Intimidating Presence", "long", 14, "Restore by expending a Rage use.")] },
      { id: "wild-heart", name: "Path of the Wild Heart", features: [] },
      { id: "world-tree", name: "Path of the World Tree", features: [] },
      {
        id: "zealot",
        name: "Path of the Zealot",
        features: [
          {
            name: "Warrior of the Gods",
            from: 3,
            uses: steps([3, 4], [6, 5], [12, 6], [17, 7]),
            recharge: "long",
            note: "Pool of d12 healing dice.",
          },
          once("Zealous Presence", "long", 10, "Restore by expending a Rage use."),
          once("Rage of the Gods", "long", 14),
        ],
      },
    ],
  },
  {
    id: "bard",
    name: "Bard",
    caster: "full",
    cantrips: CANTRIPS_2,
    prepared: PREPARED_STANDARD,
    features: [
      modUses("Bardic Inspiration", "cha", 1, { to: 4, note: "d6. Equal to your Charisma modifier." }),
      modUses("Bardic Inspiration", "cha", 5, {
        recharge: "short",
        note: "Die: d8, d10 at level 10, d12 at level 15. Expend a spell slot to regain a use.",
      }),
    ],
    subclasses: [
      { id: "dance", name: "College of Dance", features: [] },
      {
        id: "glamour",
        name: "College of Glamour",
        features: [
          once("Beguiling Magic", "long", 3, "Restore by expending a Bardic Inspiration use."),
          once("Mantle of Majesty", "long", 6, "Restore by expending a level 3+ spell slot."),
          once("Unbreakable Majesty", "short", 14),
        ],
      },
      { id: "lore", name: "College of Lore", features: [] },
      { id: "valor", name: "College of Valor", features: [] },
    ],
  },
  {
    id: "cleric",
    name: "Cleric",
    caster: "full",
    cantrips: CANTRIPS_3,
    prepared: PREPARED_STANDARD,
    features: [
      { name: "Channel Divinity", from: 2, uses: steps([2, 2], [6, 3], [18, 4]), recharge: "shortOne" },
      once("Divine Intervention", "long", 10, "Level 20: choosing Wish means waiting 2d4 long rests instead."),
    ],
    subclasses: [
      { id: "life", name: "Life Domain", features: [] },
      {
        id: "light",
        name: "Light Domain",
        features: [
          modUses("Warding Flare", "wis", 3, { to: 5 }),
          modUses("Warding Flare", "wis", 6, { recharge: "short" }),
          modUses("Corona of Light", "wis", 17),
        ],
      },
      { id: "trickery", name: "Trickery Domain", features: [] },
      {
        id: "war",
        name: "War Domain",
        features: [modUses("War Priest", "wis", 3, { recharge: "short", note: "Bonus Action weapon attacks." })],
      },
    ],
  },
  {
    id: "druid",
    name: "Druid",
    caster: "full",
    cantrips: CANTRIPS_2,
    prepared: PREPARED_STANDARD,
    features: [
      { name: "Wild Shape", from: 2, uses: steps([2, 2], [6, 3], [17, 4]), recharge: "shortOne" },
      once("Wild Resurgence", "long", 5, "Expend a Wild Shape use to gain a level 1 spell slot."),
      once("Archdruid", "long", 20, "Convert Wild Shape uses into a spell slot."),
    ],
    subclasses: [
      {
        id: "land",
        name: "Circle of the Land",
        features: [
          once("Natural Recovery (free spell)", "long", 6, "Cast a prepared Circle spell without a slot."),
          once("Natural Recovery (slots)", "long", 6, "On a short rest, recover expended spell slots."),
        ],
      },
      { id: "moon", name: "Circle of the Moon", features: [modUses("Moonlight Step", "wis", 10)] },
      { id: "sea", name: "Circle of the Sea", features: [] },
      {
        id: "stars",
        name: "Circle of the Stars",
        features: [
          modUses("Star Map: Guiding Bolt", "wis", 3, { note: "Free casts of Guiding Bolt." }),
          modUses("Cosmic Omen", "wis", 6, { note: "Weal or Woe reaction." }),
        ],
      },
    ],
  },
  {
    id: "fighter",
    name: "Fighter",
    features: [
      { name: "Second Wind", uses: steps([1, 2], [4, 3], [10, 4]), recharge: "shortOne" },
      { name: "Action Surge", from: 2, uses: steps([2, 1], [17, 2]), recharge: "short" },
      { name: "Indomitable", from: 9, uses: steps([9, 1], [13, 2], [17, 3]), recharge: "long" },
    ],
    subclasses: [
      {
        id: "battle-master",
        name: "Battle Master",
        features: [
          {
            name: "Superiority Dice",
            from: 3,
            uses: steps([3, 4], [7, 5], [15, 6]),
            recharge: "short",
            note: "d8, d10 at level 10, d12 at level 18.",
          },
          once("Know Your Enemy", "long", 7, "Restore by expending a Superiority Die."),
        ],
      },
      { id: "champion", name: "Champion", features: [] },
      { id: "eldritch-knight", name: "Eldritch Knight", caster: "third", features: [] },
      {
        id: "psi-warrior",
        name: "Psi Warrior",
        features: [
          {
            name: "Psionic Energy Dice",
            from: 3,
            uses: steps([3, 4], [5, 6], [9, 8], [13, 10], [17, 12]),
            recharge: "shortOne",
            note: "d6, d8 at level 5, d10 at level 11, d12 at level 17.",
          },
          once("Telekinetic Movement", "short", 3, "Restore by expending a Psionic Energy Die."),
          once("Psi-Powered Leap", "short", 7, "Restore by expending a Psionic Energy Die."),
          once("Bulwark of Force", "long", 15, "Restore by expending a Psionic Energy Die."),
          once("Telekinetic Master", "long", 18, "Restore by expending a Psionic Energy Die."),
        ],
      },
    ],
  },
  {
    id: "monk",
    name: "Monk",
    features: [
      {
        name: "Focus Points",
        from: 2,
        uses: (level) => level,
        recharge: "short",
        counter: true,
      },
      once("Uncanny Metabolism", "long", 2, "On initiative, regain all Focus Points and heal."),
    ],
    subclasses: [
      {
        id: "mercy",
        name: "Warrior of Mercy",
        features: [modUses("Flurry of Healing and Harm", "wis", 11), once("Hand of Ultimate Mercy", "long", 17)],
      },
      { id: "elements", name: "Warrior of the Elements", features: [] },
      { id: "open-hand", name: "Warrior of the Open Hand", features: [modUses("Wholeness of Body", "wis", 6)] },
      { id: "shadow", name: "Warrior of Shadow", features: [] },
    ],
  },
  {
    id: "paladin",
    name: "Paladin",
    caster: "half",
    prepared: PREPARED_HALF,
    features: [
      {
        name: "Lay On Hands",
        uses: (level) => level * 5,
        recharge: "long",
        counter: true,
        note: "Hit point pool: 5 × Paladin level. 5 points cure poison.",
      },
      once("Paladin's Smite", "long", 2, "Cast Divine Smite once without a spell slot."),
      { name: "Channel Divinity", from: 3, uses: steps([3, 2], [11, 3]), recharge: "shortOne" },
      once("Faithful Steed", "long", 5, "Cast Find Steed once without a spell slot."),
    ],
    subclasses: [
      { id: "devotion", name: "Oath of Devotion", features: [once("Holy Nimbus", "long", 20, "Restore by expending a level 5 spell slot.")] },
      {
        id: "glory",
        name: "Oath of Glory",
        features: [
          modUses("Glorious Defense", "cha", 15),
          once("Living Legend", "long", 20, "Restore by expending a level 5 spell slot."),
        ],
      },
      {
        id: "ancients",
        name: "Oath of the Ancients",
        features: [
          once("Undying Sentinel", "long", 15),
          once("Elder Champion", "long", 20, "Restore by expending a level 5 spell slot."),
        ],
      },
      { id: "vengeance", name: "Oath of Vengeance", features: [once("Avenging Angel", "long", 20, "Restore by expending a level 5 spell slot.")] },
    ],
  },
  {
    id: "ranger",
    name: "Ranger",
    caster: "half",
    prepared: PREPARED_HALF,
    features: [
      {
        name: "Favored Enemy",
        uses: steps([1, 2], [5, 3], [9, 4], [13, 5], [17, 6]),
        recharge: "long",
        note: "Free casts of Hunter's Mark.",
      },
      modUses("Tireless", "wis", 10, { note: "Temporary hit points as a Magic action." }),
      modUses("Nature's Veil", "wis", 14, { note: "Invisible until the end of your next turn." }),
    ],
    subclasses: [
      { id: "beast-master", name: "Beast Master", features: [] },
      {
        id: "fey-wanderer",
        name: "Fey Wanderer",
        features: [
          once("Fey Reinforcements", "long", 11, "Cast Summon Fey without a spell slot."),
          modUses("Misty Wanderer", "wis", 15, { note: "Free casts of Misty Step." }),
        ],
      },
      { id: "gloom-stalker", name: "Gloom Stalker", features: [modUses("Dread Ambusher", "wis", 3)] },
      { id: "hunter", name: "Hunter", features: [] },
    ],
  },
  {
    id: "rogue",
    name: "Rogue",
    features: [once("Stroke of Luck", "short", 20)],
    subclasses: [
      {
        id: "arcane-trickster",
        name: "Arcane Trickster",
        caster: "third",
        features: [once("Spell Thief", "long", 17)],
      },
      { id: "assassin", name: "Assassin", features: [] },
      {
        id: "soulknife",
        name: "Soulknife",
        features: [
          {
            name: "Psionic Energy Dice",
            from: 3,
            uses: steps([3, 4], [5, 6], [9, 8], [13, 10], [17, 12]),
            recharge: "shortOne",
            note: "d6, d8 at level 5, d10 at level 11, d12 at level 17.",
          },
          once("Psychic Veil", "long", 13, "Restore by expending a Psionic Energy Die."),
          once("Rend Mind", "long", 17, "Restore by expending three Psionic Energy Dice."),
        ],
      },
      { id: "thief", name: "Thief", features: [] },
    ],
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    caster: "full",
    cantrips: steps([1, 4], [4, 5], [10, 6]),
    prepared: PREPARED_SORCERER,
    features: [
      { name: "Innate Sorcery", uses: fixed(2), recharge: "long" },
      { name: "Sorcery Points", from: 2, uses: (level) => level, recharge: "long", counter: true },
      once("Sorcerous Restoration", "long", 5, "On a short rest, regain Sorcery Points up to half your level."),
    ],
    subclasses: [
      { id: "aberrant", name: "Aberrant Sorcery", features: [once("Warping Implosion", "long", 18, "Restore by spending 5 Sorcery Points.")] },
      {
        id: "clockwork",
        name: "Clockwork Sorcery",
        features: [
          modUses("Restore Balance", "cha", 3),
          once("Trance of Order", "long", 14, "Restore by spending 5 Sorcery Points."),
          once("Clockwork Cavalcade", "long", 18, "Restore by spending 7 Sorcery Points."),
        ],
      },
      {
        id: "draconic",
        name: "Draconic Sorcery",
        features: [
          once("Dragon Wings", "long", 14, "Restore by spending 3 Sorcery Points."),
          once("Dragon Companion", "long", 18, "Cast Summon Dragon without a spell slot."),
        ],
      },
      {
        id: "wild-magic",
        name: "Wild Magic Sorcery",
        features: [
          once("Tides of Chaos", "long", 3, "Also regained after casting a Sorcerer spell with a slot."),
          once("Tamed Surge", "long", 18),
        ],
      },
    ],
  },
  {
    id: "warlock",
    name: "Warlock",
    caster: "pact",
    cantrips: CANTRIPS_2,
    prepared: PREPARED_WARLOCK,
    features: [
      once("Magical Cunning", "long", 2, "Regain Pact Magic slots up to half your maximum (all at level 20)."),
      once("Contact Patron", "long", 9, "Cast Contact Other Plane without a spell slot."),
      once("Mystic Arcanum (6th level)", "long", 11),
      once("Mystic Arcanum (7th level)", "long", 13),
      once("Mystic Arcanum (8th level)", "long", 15),
      once("Mystic Arcanum (9th level)", "long", 17),
    ],
    subclasses: [
      {
        id: "archfey",
        name: "Archfey Patron",
        features: [
          modUses("Steps of the Fey", "cha", 3, { note: "Free casts of Misty Step." }),
          once("Beguiling Defenses", "long", 10, "Restore by expending a Pact Magic slot."),
        ],
      },
      {
        id: "celestial",
        name: "Celestial Patron",
        features: [
          {
            name: "Healing Light",
            from: 3,
            uses: (level) => level + 1,
            recharge: "long",
            note: "Pool of d6 healing dice: 1 + Warlock level.",
          },
          once("Searing Vengeance", "long", 14),
        ],
      },
      {
        id: "fiend",
        name: "Fiend Patron",
        features: [
          modUses("Dark One's Own Luck", "cha", 6),
          once("Hurl Through Hell", "long", 14, "Restore by expending a Pact Magic slot."),
        ],
      },
      {
        id: "great-old-one",
        name: "Great Old One Patron",
        features: [once("Clairvoyant Combatant", "short", 6, "Restore by expending a Pact Magic slot.")],
      },
      // Not in the Player's Handbook: the Vestige Patron is third-party 2024-rules content (dnd2024.wikidot.com).
      {
        id: "vestige",
        name: "Vestige Patron",
        features: [
          { ...once("Divine Power", "long", 3, "The vestige's Bonus Action, by type."), to: 5 },
          once("Divine Power", "short", 6, "Also back when you use Magical Cunning."),
          once("Vestige Recovery", "long", 10, "Reaction: expend a Pact Magic slot to restore the vestige to full HP."),
          once("Semblance of Life", "long", 14, "Turn the vestige into a spirit for 1 hour."),
        ],
      },
    ],
  },
  {
    id: "wizard",
    name: "Wizard",
    caster: "full",
    cantrips: CANTRIPS_3,
    prepared: PREPARED_WIZARD,
    features: [
      once("Arcane Recovery", "long", 1, "On a short rest, recover slots worth up to half your level (rounded up), none above level 5."),
      { name: "Signature Spells", from: 20, uses: fixed(2), recharge: "short", note: "Two spells, each cast once at level 3 for free." },
    ],
    subclasses: [
      { id: "abjurer", name: "Abjurer", features: [once("Arcane Ward", "long", 3, "Create the ward once per long rest.")] },
      {
        id: "diviner",
        name: "Diviner",
        features: [
          {
            name: "Portent",
            from: 3,
            uses: steps([3, 2], [14, 3]),
            recharge: "long",
            note: "Foretelling d20 rolls, rolled after a long rest.",
          },
        ],
      },
      { id: "evoker", name: "Evoker", features: [] },
      {
        id: "illusionist",
        name: "Illusionist",
        features: [
          once("Phantasmal Creatures: Summon Beast", "long", 6),
          once("Phantasmal Creatures: Summon Fey", "long", 6),
          once("Illusory Self", "short", 10, "Restore by expending a level 2+ spell slot."),
        ],
      },
    ],
  },
];

export const CLASS_BY_ID: Record<ClassId, ClassRules> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c]),
) as Record<ClassId, ClassRules>;

export function isClassId(v: unknown): v is ClassId {
  return typeof v === "string" && v in CLASS_BY_ID;
}

// --- spell slots ---------------------------------------------------------------------------

/** Slots per spell level (1st–9th) for a full caster of each level 1–20. This is also the Multiclass Spellcaster table. */
const FULL_CASTER: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Eldritch Knight and Arcane Trickster, Fighter/Rogue levels 3–20. */
const THIRD_CASTER: number[][] = [
  [2],
  [3],
  [3],
  [3],
  [4, 2],
  [4, 2],
  [4, 2],
  [4, 3],
  [4, 3],
  [4, 3],
  [4, 3, 2],
  [4, 3, 2],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 1],
];

export interface ClassEntry {
  classId: ClassId;
  subclassId?: string;
  level: number;
}

export function clampLevel(level: number): number {
  return Math.min(20, Math.max(1, Math.trunc(level) || 1));
}

export function subclassOf(entry: ClassEntry): SubclassRules | undefined {
  return CLASS_BY_ID[entry.classId].subclasses.find((s) => s.id === entry.subclassId);
}

export function casterKind(entry: ClassEntry): CasterKind | null {
  const cls = CLASS_BY_ID[entry.classId];
  if (cls.caster) return cls.caster;
  return subclassOf(entry)?.caster === "third" && entry.level >= 3 ? "third" : null;
}

/** Pact Magic: a few slots that are all the same level and come back on a short rest. */
export function pactSlots(level: number): { count: number; level: number } {
  return {
    count: level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1,
    level: Math.min(5, Math.ceil(level / 2)),
  };
}

export interface SlotPlan {
  /** Slot counts for spell levels 1–9. */
  slots: number[];
  pact: { count: number; level: number } | null;
  /** How the regular slots were worked out. */
  method: "none" | "single" | "multiclass";
  /** Combined caster level, for multiclass characters. */
  casterLevel: number;
}

const pad9 = (row: number[] | undefined) => Array.from({ length: 9 }, (_, i) => row?.[i] ?? 0);

/** Slots for a lone spellcasting class use its own table; two or more combine through the Multiclass Spellcaster table. */
export function planSlots(entries: ClassEntry[]): SlotPlan {
  const casters = entries
    .map((e) => ({ e, kind: casterKind(e) }))
    .filter((c): c is { e: ClassEntry; kind: Exclude<CasterKind, "pact"> } => c.kind !== null && c.kind !== "pact");
  const warlock = entries.find((e) => e.classId === "warlock");
  const pact = warlock ? pactSlots(warlock.level) : null;

  if (casters.length === 0) return { slots: pad9(undefined), pact, method: "none", casterLevel: 0 };

  if (casters.length === 1) {
    const { e, kind } = casters[0];
    const row =
      kind === "full"
        ? FULL_CASTER[e.level - 1]
        : kind === "half"
          ? FULL_CASTER[Math.ceil(e.level / 2) - 1]
          : THIRD_CASTER[e.level - 3];
    return { slots: pad9(row), pact, method: "single", casterLevel: e.level };
  }

  const total = casters.reduce(
    (sum, { e, kind }) =>
      sum + (kind === "full" ? e.level : kind === "half" ? Math.ceil(e.level / 2) : Math.floor(e.level / 3)),
    0,
  );
  const casterLevel = Math.min(20, total);
  return { slots: pad9(FULL_CASTER[casterLevel - 1]), pact, method: "multiclass", casterLevel };
}

// --- abilities -----------------------------------------------------------------------------

export interface PlannedAbility {
  id: string;
  name: string;
  source: string;
  max: number;
  recharge: Recharge;
  counter: boolean;
  note?: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Every limited-use feature the character has at its current level. */
export function planAbilities(entries: ClassEntry[], mods: Mods): PlannedAbility[] {
  const out: PlannedAbility[] = [];
  for (const entry of entries) {
    const cls = CLASS_BY_ID[entry.classId];
    const sub = subclassOf(entry);
    const groups: { owner: string; source: string; features: Feature[] }[] = [
      { owner: cls.id, source: cls.name, features: cls.features },
    ];
    if (sub) groups.push({ owner: `${cls.id}-${sub.id}`, source: `${cls.name} · ${sub.name}`, features: sub.features });

    for (const { owner, source, features } of groups) {
      for (const f of features) {
        if (entry.level < (f.from ?? 1) || entry.level > (f.to ?? 20)) continue;
        const max = f.uses(entry.level, mods);
        if (max <= 0) continue;
        out.push({
          id: `${owner}:${slug(f.name)}`,
          name: f.name,
          source,
          max,
          recharge: f.recharge,
          counter: f.counter ?? false,
          note: f.note,
        });
      }
    }
  }
  return out;
}

/** Which ability modifiers the chosen classes actually use, so the form only asks for those. */
export function neededMods(entries: ClassEntry[]): ModName[] {
  const needed = new Set<ModName>();
  for (const entry of entries) {
    const sub = subclassOf(entry);
    for (const f of [...CLASS_BY_ID[entry.classId].features, ...(sub?.features ?? [])]) {
      if (f.mod && entry.level >= (f.from ?? 1) && entry.level <= (f.to ?? 20)) needed.add(f.mod);
    }
  }
  return [...needed];
}

export interface CastingSummary {
  className: string;
  level: number;
  cantrips?: number;
  prepared?: number;
}

/** Cantrips and prepared spells for each spellcasting class, for the setup summary. */
export function castingSummary(entries: ClassEntry[]): CastingSummary[] {
  return entries.flatMap((e): CastingSummary[] => {
    const cls = CLASS_BY_ID[e.classId];
    if (cls.caster) {
      return [{ className: cls.name, level: e.level, cantrips: cls.cantrips?.(e.level), prepared: cls.prepared?.(e.level) }];
    }
    if (casterKind(e) === "third") {
      return [{ className: `${cls.name} (${subclassOf(e)?.name})`, level: e.level, prepared: PREPARED_THIRD(e.level) }];
    }
    return [];
  });
}
