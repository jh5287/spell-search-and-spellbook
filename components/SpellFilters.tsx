"use client";

import { useId } from "react";
import { useLocalStore } from "@/lib/localStore";
import { filtersOpen } from "@/lib/spellbook";
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

/** "Bonus action · No concentration": what's narrowing the list, readable even while the chips are tucked away. */
function summarize(filters: BookFilters): string {
  return [
    ...CASTING_OPTIONS.filter((o) => filters.casting.includes(o.value)),
    ...CONCENTRATION_OPTIONS.filter((o) => filters.concentration.includes(o.value)),
    ...EFFECT_OPTIONS.filter((o) => filters.effects.includes(o.value)),
  ]
    .map((o) => o.label)
    .join(" · ");
}

/**
 * One tap per filter, so mid-fight it's quick to ask "what can I do with a bonus action?" or "what won't break my
 * concentration?". Choices in one row add up; the rows narrow each other down. The chips fold away to a single line
 * that still shows the active filters, so they don't take over the page.
 */
export default function SpellFilters({ filters, onChange, shown, total }: Props) {
  const [open, setOpen] = useLocalStore(filtersOpen);
  const panelId = useId();
  const active = activeFilterCount(filters);

  return (
    <section className={styles.bar} aria-label="Filter spells">
      <div className={styles.header}>
        <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
          <span className={styles.caret} aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          Filters
          {active > 0 && (
            <span className={styles.badge} aria-label={`${active} active`}>
              {active}
            </span>
          )}
        </button>
        {!open && active > 0 && <span className={styles.summary}>{summarize(filters)}</span>}
        <p role="status" className={styles.count}>
          {active > 0 ? `Showing ${shown} of ${total} spells` : `${total} ${total === 1 ? "spell" : "spells"}`}
        </p>
        {active > 0 && (
          <button type="button" className="btn" onClick={() => onChange(NO_FILTERS)}>
            Clear
          </button>
        )}
      </div>

      {open && (
        <div id={panelId} className={styles.panel}>
          <div className={styles.group} role="group" aria-labelledby={`${panelId}-casting`}>
            <span id={`${panelId}-casting`} className={styles.label}>
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

          <div className={styles.group} role="group" aria-labelledby={`${panelId}-concentration`}>
            <span id={`${panelId}-concentration`} className={styles.label}>
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

          <div className={styles.group} role="group" aria-labelledby={`${panelId}-effects`}>
            <span id={`${panelId}-effects`} className={styles.label}>
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
        </div>
      )}
    </section>
  );
}
