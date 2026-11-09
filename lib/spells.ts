const API = "https://www.dnd5eapi.co";

export interface SpellSummary {
  index: string;
  name: string;
  level: number;
  url: string;
}

export interface Spell {
  index: string;
  name: string;
  level: number;
  school: { name: string };
  casting_time: string;
  range: string;
  components: string[];
  material?: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higher_level?: string;
  classes: { name: string }[];
  /** Created by the user rather than fetched from the API. */
  custom?: boolean;
  /** Set on custom entries that aren't spells (e.g. "Ability", "Item"); `level` is meaningless then. */
  kind?: string;
  /** Present on the API's damaging spells (not all of them). Only its presence is used, to spot damage. */
  damage?: unknown;
}

export async function fetchSpellList(signal?: AbortSignal): Promise<SpellSummary[]> {
  const res = await fetch(`${API}/api/2024/spells`, { signal });
  if (!res.ok) throw new Error("Could not load the spell list");
  const data = await res.json();
  return data.results;
}

export async function fetchSpell(url: string, signal?: AbortSignal): Promise<Spell> {
  const res = await fetch(`${API}${url}`, { signal });
  if (!res.ok) throw new Error("Could not load that spell");
  return res.json();
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function isSubsequence(q: string, name: string): boolean {
  let matched = 0;
  for (const ch of name) if (ch === q[matched] && ++matched === q.length) return true;
  return false;
}

/** Lower is better; null means the name doesn't match the typed text at all. */
function matchScore(q: string, name: string): number | null {
  if (name === q) return 0;
  const words = name.split(" ");
  const tokens = q.split(" ");
  if (name.startsWith(q)) return 1 + name.length - q.length;
  if (words.some((w) => w.startsWith(q))) return 100 + name.length - q.length;
  if (name.includes(q)) return 200 + name.length - q.length;
  // several typed words, each starting a different word of the name, in any order
  if (tokens.length > 1 && tokens.every((t) => words.some((w) => w.startsWith(t)))) return 250 + name.length;

  if (q.length < 3) return null;
  // typo tolerance: compare against the same-length start of the whole name and of each word in it
  const d = Math.min(...[name, ...words].map((w) => distance(q, w.slice(0, q.length))));
  if (d <= Math.max(1, Math.floor(q.length / 3))) return 300 + d * 10 + name.length;
  // initials and skipped letters, e.g. "fbl" for Fireball
  if (isSubsequence(q.replaceAll(" ", ""), name.replaceAll(" ", ""))) return 500 + name.length;
  return null;
}

/** Every spell that plausibly matches the typed text, best match first. */
export function suggestSpells(query: string, spells: SpellSummary[]): SpellSummary[] {
  const q = normalize(query);
  if (!q) return [];

  return spells
    .flatMap((spell) => {
      const score = matchScore(q, normalize(spell.name));
      return score === null ? [] : [{ spell, score }];
    })
    .sort((a, b) => a.score - b.score || a.spell.name.localeCompare(b.spell.name))
    .map((m) => m.spell);
}

export function ordinal(n: number): string {
  const suffix = ["th", "st", "nd", "rd"][n] ?? "th";
  return `${n}${suffix}`;
}

/** "Cantrip" or "3rd level", for lists of spells. */
export function levelText(level: number): string {
  return level === 0 ? "Cantrip" : `${ordinal(level)} level`;
}

export function levelLabel(spell: Spell): string {
  if (spell.kind) return spell.kind;
  const school = spell.school.name;
  if (spell.level === 0) return school ? `${school} cantrip` : "Cantrip";
  return school ? `${ordinal(spell.level)}-level ${school.toLowerCase()}` : `${ordinal(spell.level)}-level spell`;
}

/** e.g. "3rd-level evocation · Sorcerer, Wizard"; custom entries may have no classes. */
export function subtitle(spell: Spell): string {
  return [levelLabel(spell), spell.classes.map((c) => c.name).join(", ")].filter(Boolean).join(" · ");
}
