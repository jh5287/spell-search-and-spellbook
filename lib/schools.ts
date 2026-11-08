/** The eight schools of magic. Each has a colour, defined as `--school-<name>` in globals.css. */
export const SCHOOLS = [
  "Abjuration",
  "Conjuration",
  "Divination",
  "Enchantment",
  "Evocation",
  "Illusion",
  "Necromancy",
  "Transmutation",
] as const;

const KEYS: ReadonlySet<string> = new Set(SCHOOLS.map((s) => s.toLowerCase()));

/** The CSS variable holding a school's colour, or undefined for anything else (custom entries can use any text). */
export function schoolVar(school: string): string | undefined {
  const key = school.trim().toLowerCase();
  return KEYS.has(key) ? `var(--school-${key})` : undefined;
}
