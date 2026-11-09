"use client";

import {
  CASTING_OPTIONS,
  CONCENTRATION_OPTIONS,
  EFFECT_OPTIONS,
  NO_FILTERS,
  activeFilterCount,
  toggleIn,
  type BookFilters,
} from "@/lib/spellFilters";
import styles from "./SpellFilters.module.css";

interface Props {
  filters: BookFilters;
  onChange: (filters: BookFilters) => void;
  shown: number;
  total: number;
}

function Chip({ pressed, title, onClick, children }: { pressed: boolean; title?: string; onClick: () => void; children: string }) {
  return (
    <button type="button" className={styles.chip} aria-pressed={pressed} title={title} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * One tap per filter, always on screen, so mid-fight it's quick to ask "what can I do with a bonus action?" or
 * "what won't break my concentration?". Choices in one row add up; the rows narrow each other down.
 */
export default function SpellFilters({ filters, onChange, shown, total }: Props) {
  const active = activeFilterCount(filters);

  return (
    <section className={styles.bar} aria-label="Filter spells">
      <div className={styles.group} role="group" aria-labelledby="filter-casting">
        <span id="filter-casting" className={styles.label}>
          Takes a
        </span>
        {CASTING_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            pressed={filters.casting.includes(o.value)}
            onClick={() => onChange({ ...filters, casting: toggleIn(filters.casting, o.value) })}
          >
            {o.label}
          </Chip>
        ))}
      </div>

      <div className={styles.group} role="group" aria-labelledby="filter-concentration">
        <span id="filter-concentration" className={styles.label}>
          Concentration
        </span>
        {CONCENTRATION_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            title={o.hint}
            pressed={filters.concentration.includes(o.value)}
            onClick={() => onChange({ ...filters, concentration: toggleIn(filters.concentration, o.value) })}
          >
            {o.label}
          </Chip>
        ))}
      </div>

      <div className={styles.group} role="group" aria-labelledby="filter-effects">
        <span id="filter-effects" className={styles.label}>
          Does
        </span>
        {EFFECT_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            pressed={filters.effects.includes(o.value)}
            onClick={() => onChange({ ...filters, effects: toggleIn(filters.effects, o.value) })}
          >
            {o.label}
          </Chip>
        ))}
      </div>

      <div className={styles.footer}>
        <p role="status" className={styles.count}>
          {active > 0 ? `Showing ${shown} of ${total} spells` : `${total} ${total === 1 ? "spell" : "spells"}`}
        </p>
        {active > 0 && (
          <button type="button" className="btn" onClick={() => onChange(NO_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
