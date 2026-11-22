import type { Recharge } from "./classRules";

/**
 * Starting points for the "Add ability" form. Picking one only fills the form in; everything can still be changed.
 * For anything outside the 2024 rules (older editions, homebrew, items), these generic patterns and a blank form are
 * the way in.
 */
export interface AbilityTemplate {
  id: string;
  /** What the picker shows. */
  label: string;
  name: string;
  source: string;
  /** "pb" means the character's proficiency bonus. */
  uses: number | "pb";
  recharge: Recharge;
  regain?: number;
  counter?: boolean;
  note: string;
}

export const ABILITY_TEMPLATES: AbilityTemplate[] = [
  { id: "once-turn", label: "Once per turn", name: "Once-per-turn effect", source: "", uses: 1, recharge: "turn", note: "Ready again at the start of your turn." },
  { id: "reaction", label: "Reaction (once per round)", name: "Reaction", source: "", uses: 1, recharge: "turn", note: "Shared by Opportunity Attacks, Shield, Interception, Protection, Defensive Duelist and every other reaction. Ready again at the start of your turn." },
  { id: "once-short", label: "Once per short or long rest", name: "Short rest ability", source: "", uses: 1, recharge: "short", note: "" },
  { id: "once-long", label: "Once per long rest", name: "Long rest ability", source: "", uses: 1, recharge: "long", note: "" },
  { id: "charges", label: "A few charges (long rest)", name: "Charges", source: "", uses: 3, recharge: "long", note: "" },
  { id: "pool", label: "Pool of points (long rest)", name: "Points", source: "", uses: 10, recharge: "long", counter: true, note: "A number to count down, for big pools like hit points to spend or points to burn." },
  { id: "pb-long", label: "Uses equal to proficiency bonus (long rest)", name: "Proficiency uses", source: "", uses: "pb", recharge: "long", note: "Uses equal your proficiency bonus; update it when that goes up." },
  { id: "regain-short", label: "Regain some on a short rest", name: "Recovering uses", source: "", uses: 4, recharge: "shortOne", regain: 1, note: "Regain 1 use on a short rest and all of them on a long rest. Change how many come back when you edit it." },
];

export const TEMPLATE_BY_ID: Record<string, AbilityTemplate> = Object.fromEntries(ABILITY_TEMPLATES.map((t) => [t.id, t]));

// --- feats ---------------------------------------------------------------------------------------

const PB_NOTE = " Uses equal your proficiency bonus; update it when that goes up.";

export interface FeatTracker {
  name: string;
  uses: number | "pb";
  recharge: Recharge;
  regain?: number;
  counter?: boolean;
  note: string;
  /** Tracked once however many feats mention it, like your Reaction, and listed under `group` instead of a feat. */
  shared?: boolean;
  group?: string;
}

/** A 2024 Player's Handbook feat that has something worth keeping count of. */
export interface FeatTemplate {
  id: string;
  name: string;
  trackers: FeatTracker[];
}

const REACTION: FeatTracker = {
  name: "Reaction",
  uses: 1,
  recharge: "turn",
  shared: true,
  group: "Reaction (shared by Interception, Protection, Sentinel and more)",
  note: "Your one Reaction each round, shared by every reaction feature. Ready again at the start of your turn.",
};

/** In alphabetical order. Wording and numbers are from the 2024 Player's Handbook. */
export const FEAT_TEMPLATES: FeatTemplate[] = [
  { id: "boon-combat-prowess", name: "Boon of Combat Prowess", trackers: [{ name: "Peerless Aim", uses: 1, recharge: "turn", note: "When you miss with an attack roll, you can hit instead. Ready again at the start of your next turn." }] },
  { id: "boon-fate", name: "Boon of Fate", trackers: [{ name: "Improve Fate", uses: 1, recharge: "short", note: "Add or subtract 2d4 on a D20 Test within 60 feet. It's also ready again when you roll Initiative: tap its dot to restore it then." }] },
  {
    id: "boon-recovery",
    name: "Boon of Recovery",
    trackers: [
      { name: "Last Stand", uses: 1, recharge: "long", note: "When reduced to 0 Hit Points, drop to 1 instead and regain half your Hit Point maximum." },
      { name: "Recover Vitality (d10s)", uses: 10, recharge: "long", counter: true, note: "A pool of ten d10s. As a Bonus Action, spend dice and regain Hit Points equal to the roll." },
    ],
  },
  { id: "charger", name: "Charger", trackers: [{ name: "Charge Attack", uses: 1, recharge: "turn", note: "Once per turn, after moving 10+ feet straight at a target before a melee hit, add 1d8 damage or push it 10 feet." }] },
  { id: "chef", name: "Chef", trackers: [{ name: "Bolstering Treats", uses: "pb", recharge: "long", note: "Treats you can cook after a long rest; eating one gives Temporary Hit Points." + PB_NOTE }] },
  { id: "crusher", name: "Crusher", trackers: [{ name: "Crusher", uses: 1, recharge: "turn", note: "Once per turn, when you hit with Bludgeoning damage, move the target 5 feet (no more than one size larger than you)." }] },
  { id: "defensive-duelist", name: "Defensive Duelist", trackers: [REACTION] },
  {
    id: "fey-touched",
    name: "Fey Touched",
    trackers: [
      { name: "Misty Step", uses: 1, recharge: "long", note: "Cast Misty Step once without a spell slot." },
      { name: "Chosen spell", uses: 1, recharge: "long", note: "Cast your chosen level 1 Divination or Enchantment spell once without a spell slot. Rename this to the spell." },
    ],
  },
  { id: "grappler", name: "Grappler", trackers: [{ name: "Punch and Grab", uses: 1, recharge: "turn", note: "Once per turn, when you hit with an Unarmed Strike as part of the Attack action, use both the Damage and the Grapple option." }] },
  { id: "interception", name: "Interception (Fighting Style)", trackers: [REACTION] },
  { id: "lucky", name: "Lucky", trackers: [{ name: "Luck Points", uses: "pb", recharge: "long", note: "Spend 1 for Advantage on a D20 Test, or to impose Disadvantage on an attack roll against you." + PB_NOTE }] },
  { id: "mage-slayer", name: "Mage Slayer", trackers: [{ name: "Guarded Mind", uses: 1, recharge: "short", note: "If you fail an Intelligence, Wisdom or Charisma save, you can succeed instead." }] },
  { id: "magic-initiate", name: "Magic Initiate", trackers: [{ name: "Level 1 spell", uses: 1, recharge: "long", note: "Cast your chosen level 1 spell once without a spell slot. Rename this to the spell." }] },
  { id: "piercer", name: "Piercer", trackers: [{ name: "Piercer", uses: 1, recharge: "turn", note: "Once per turn, when you hit with Piercing damage, reroll one of the damage dice and use the new roll." }] },
  { id: "protection", name: "Protection (Fighting Style)", trackers: [REACTION] },
  { id: "savage-attacker", name: "Savage Attacker", trackers: [{ name: "Savage Attacker", uses: 1, recharge: "turn", note: "Once per turn, when you hit with a weapon, roll its damage dice twice and use either roll." }] },
  { id: "sentinel", name: "Sentinel", trackers: [REACTION] },
  {
    id: "shadow-touched",
    name: "Shadow Touched",
    trackers: [
      { name: "Invisibility", uses: 1, recharge: "long", note: "Cast Invisibility once without a spell slot." },
      { name: "Chosen spell", uses: 1, recharge: "long", note: "Cast your chosen level 1 Illusion or Necromancy spell once without a spell slot. Rename this to the spell." },
    ],
  },
  { id: "shield-master", name: "Shield Master", trackers: [{ name: "Shield Bash", uses: 1, recharge: "turn", note: "Once per turn, after a melee hit in the Attack action, bash the target: Strength save or pushed 5 feet or knocked Prone." }] },
  { id: "slasher", name: "Slasher", trackers: [{ name: "Slasher", uses: 1, recharge: "turn", note: "Once per turn, when you hit with Slashing damage, reduce the target's Speed by 10 feet until the start of your next turn." }] },
  { id: "tavern-brawler", name: "Tavern Brawler", trackers: [{ name: "Push", uses: 1, recharge: "turn", note: "Once per turn, when you hit with an Unarmed Strike as part of the Attack action, also push the target 5 feet." }] },
  { id: "telepathic", name: "Telepathic", trackers: [{ name: "Detect Thoughts", uses: 1, recharge: "long", note: "Cast Detect Thoughts once without a spell slot or components." }] },
  { id: "war-caster", name: "War Caster (Reactive Spell)", trackers: [REACTION] },
];

export const FEAT_BY_ID: Record<string, FeatTemplate> = Object.fromEntries(FEAT_TEMPLATES.map((f) => [f.id, f]));
