import type { Recharge } from "./classRules";

/**
 * Starting points for the "Add ability" form. Picking one only fills the form in; everything can still be changed.
 * The feats are from the 2024 Player's Handbook. Anything else (older editions, homebrew, items) is what the
 * generic patterns and a blank form are for.
 */
export interface AbilityTemplate {
  id: string;
  group: "Patterns" | "Feats";
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

const PB_NOTE = " Uses equal your proficiency bonus; update it when that goes up.";

export const ABILITY_TEMPLATES: AbilityTemplate[] = [
  // --- generic patterns: the shapes most homebrew and older-edition features take ---
  { id: "once-turn", group: "Patterns", label: "Once per turn", name: "Once-per-turn effect", source: "", uses: 1, recharge: "turn", note: "Ready again at the start of your turn." },
  { id: "reaction", group: "Patterns", label: "Reaction (once per round)", name: "Reaction", source: "", uses: 1, recharge: "turn", note: "Shared by Opportunity Attacks, Shield, Interception, Protection, Defensive Duelist and every other reaction. Ready again at the start of your turn." },
  { id: "once-short", group: "Patterns", label: "Once per short or long rest", name: "Short rest ability", source: "", uses: 1, recharge: "short", note: "" },
  { id: "once-long", group: "Patterns", label: "Once per long rest", name: "Long rest ability", source: "", uses: 1, recharge: "long", note: "" },
  { id: "charges", group: "Patterns", label: "A few charges (long rest)", name: "Charges", source: "", uses: 3, recharge: "long", note: "" },
  { id: "pool", group: "Patterns", label: "Pool of points (long rest)", name: "Points", source: "", uses: 10, recharge: "long", counter: true, note: "A number to count down, for big pools like hit points to spend or points to burn." },
  { id: "pb-long", group: "Patterns", label: "Uses equal to proficiency bonus (long rest)", name: "Proficiency uses", source: "", uses: "pb", recharge: "long", note: "Uses equal your proficiency bonus; update it when that goes up." },
  { id: "regain-short", group: "Patterns", label: "Regain some on a short rest", name: "Recovering uses", source: "", uses: 4, recharge: "shortOne", regain: 1, note: "Regain 1 use on a short rest and all of them on a long rest. Change how many come back when you edit it." },

  // --- feats (2024 Player's Handbook) ---
  { id: "lucky", group: "Feats", label: "Lucky: Luck Points", name: "Luck Points", source: "Feat: Lucky", uses: "pb", recharge: "long", note: "Spend 1 for Advantage on a D20 Test, or to impose Disadvantage on an attack roll against you." + PB_NOTE },
  { id: "savage-attacker", group: "Feats", label: "Savage Attacker", name: "Savage Attacker", source: "Feat: Savage Attacker", uses: 1, recharge: "turn", note: "Once per turn, when you hit with a weapon, roll its damage dice twice and use either roll." },
  { id: "crusher", group: "Feats", label: "Crusher", name: "Crusher", source: "Feat: Crusher", uses: 1, recharge: "turn", note: "Once per turn, when you hit with Bludgeoning damage, move the target 5 feet (no more than one size larger than you)." },
  { id: "piercer", group: "Feats", label: "Piercer", name: "Piercer", source: "Feat: Piercer", uses: 1, recharge: "turn", note: "Once per turn, when you hit with Piercing damage, reroll one of the damage dice and use the new roll." },
  { id: "slasher", group: "Feats", label: "Slasher", name: "Slasher", source: "Feat: Slasher", uses: 1, recharge: "turn", note: "Once per turn, when you hit with Slashing damage, reduce the target's Speed by 10 feet until the start of your next turn." },
  { id: "tavern-brawler", group: "Feats", label: "Tavern Brawler: Push", name: "Push", source: "Feat: Tavern Brawler", uses: 1, recharge: "turn", note: "Once per turn, when you hit with an Unarmed Strike as part of the Attack action, also push the target 5 feet." },
  { id: "grappler", group: "Feats", label: "Grappler: Punch and Grab", name: "Punch and Grab", source: "Feat: Grappler", uses: 1, recharge: "turn", note: "Once per turn, when you hit with an Unarmed Strike as part of the Attack action, use both the Damage and the Grapple option." },
  { id: "shield-master", group: "Feats", label: "Shield Master: Shield Bash", name: "Shield Bash", source: "Feat: Shield Master", uses: 1, recharge: "turn", note: "Once per turn, after a melee hit in the Attack action, bash the target: Strength save or pushed 5 feet or knocked Prone." },
  { id: "charger", group: "Feats", label: "Charger: Charge Attack", name: "Charge Attack", source: "Feat: Charger", uses: 1, recharge: "turn", note: "Once per turn, after moving 10+ feet straight at a target before a melee hit, add 1d8 damage or push it 10 feet." },
  { id: "fey-touched-step", group: "Feats", label: "Fey Touched: Misty Step", name: "Fey Magic: Misty Step", source: "Feat: Fey Touched", uses: 1, recharge: "long", note: "Cast Misty Step once without a spell slot." },
  { id: "fey-touched-spell", group: "Feats", label: "Fey Touched: chosen spell", name: "Fey Magic: chosen spell", source: "Feat: Fey Touched", uses: 1, recharge: "long", note: "Cast your chosen level 1 Divination or Enchantment spell once without a spell slot. Rename this to the spell." },
  { id: "shadow-touched-invisibility", group: "Feats", label: "Shadow Touched: Invisibility", name: "Shadow Magic: Invisibility", source: "Feat: Shadow Touched", uses: 1, recharge: "long", note: "Cast Invisibility once without a spell slot." },
  { id: "shadow-touched-spell", group: "Feats", label: "Shadow Touched: chosen spell", name: "Shadow Magic: chosen spell", source: "Feat: Shadow Touched", uses: 1, recharge: "long", note: "Cast your chosen level 1 Illusion or Necromancy spell once without a spell slot. Rename this to the spell." },
  { id: "magic-initiate", group: "Feats", label: "Magic Initiate: level 1 spell", name: "Magic Initiate spell", source: "Feat: Magic Initiate", uses: 1, recharge: "long", note: "Cast your chosen level 1 spell once without a spell slot. Rename this to the spell." },
  { id: "telepathic", group: "Feats", label: "Telepathic: Detect Thoughts", name: "Detect Thoughts", source: "Feat: Telepathic", uses: 1, recharge: "long", note: "Cast Detect Thoughts once without a spell slot or components." },
  { id: "mage-slayer", group: "Feats", label: "Mage Slayer: Guarded Mind", name: "Guarded Mind", source: "Feat: Mage Slayer", uses: 1, recharge: "short", note: "If you fail an Intelligence, Wisdom or Charisma save, you can succeed instead." },
  { id: "chef", group: "Feats", label: "Chef: Bolstering Treats", name: "Bolstering Treats", source: "Feat: Chef", uses: "pb", recharge: "long", note: "Treats you can cook after a long rest; eating one gives Temporary Hit Points." + PB_NOTE },
  { id: "boon-recovery-stand", group: "Feats", label: "Boon of Recovery: Last Stand", name: "Last Stand", source: "Epic Boon: Recovery", uses: 1, recharge: "long", note: "When reduced to 0 Hit Points, drop to 1 instead and regain half your Hit Point maximum." },
  { id: "boon-recovery-vitality", group: "Feats", label: "Boon of Recovery: Recover Vitality", name: "Recover Vitality (d10s)", source: "Epic Boon: Recovery", uses: 10, recharge: "long", counter: true, note: "A pool of ten d10s. As a Bonus Action, spend dice and regain Hit Points equal to the roll." },
  { id: "boon-combat-prowess", group: "Feats", label: "Boon of Combat Prowess: Peerless Aim", name: "Peerless Aim", source: "Epic Boon: Combat Prowess", uses: 1, recharge: "turn", note: "When you miss with an attack roll, you can hit instead. Ready again at the start of your next turn." },
  { id: "boon-fate", group: "Feats", label: "Boon of Fate: Improve Fate", name: "Improve Fate", source: "Epic Boon: Fate", uses: 1, recharge: "short", note: "Add or subtract 2d4 on a D20 Test within 60 feet. It's also ready again when you roll Initiative: tap its dot to restore it then." },
];

export const TEMPLATE_BY_ID: Record<string, AbilityTemplate> = Object.fromEntries(ABILITY_TEMPLATES.map((t) => [t.id, t]));
