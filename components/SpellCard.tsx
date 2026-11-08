import type { CSSProperties, ReactNode } from "react";
import type { BookView } from "@/lib/spellbook";
import { schoolVar } from "@/lib/schools";
import { subtitle, type Spell } from "@/lib/spells";
import styles from "./SpellCard.module.css";

interface Props {
  spell: Spell;
  variant?: BookView;
  headingLevel?: 2 | 3;
  /** Drag handle, rendered at the start of the card. */
  handle?: ReactNode;
  /** Buttons, rendered at the end of the card. */
  actions?: ReactNode;
}

/** Custom entries can leave fields blank, so only rows that have a value are shown. */
function Details({ spell }: { spell: Spell }) {
  const components = spell.components.join(", ") + (spell.material ? ` (${spell.material})` : "");
  const rows: [string, string][] = [
    ["Casting Time", [spell.casting_time, spell.ritual && "(ritual)"].filter(Boolean).join(" ")],
    ["Range", spell.range],
    ["Components", components],
    ["Duration", [spell.concentration && "Concentration", spell.duration].filter(Boolean).join(", ")],
  ];
  const shownRows = rows.filter(([, value]) => value.trim());

  return (
    <>
      {shownRows.length > 0 && (
        <dl className={styles.stats}>
          {shownRows.map(([label, value]) => (
            <div key={label} className={styles.stat}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {spell.description.split("\n").map((p, i) => <p key={i}>{p.trim()}</p>)}
      {spell.higher_level && (
        <p><strong>Using a Higher-Level Spell Slot.</strong> {spell.higher_level}</p>
      )}
    </>
  );
}

function Tags({ spell, flags }: { spell: Spell; flags?: boolean }) {
  return (
    <>
      {flags && spell.concentration && <span className={styles.tag} title="Concentration">C</span>}
      {flags && spell.ritual && <span className={styles.tag} title="Ritual">R</span>}
      {spell.custom && <span className={styles.tag} title="Created by you">Custom</span>}
    </>
  );
}

export default function SpellCard({ spell, variant = "full", headingLevel = 2, handle, actions }: Props) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  // custom entries that aren't spells, or use a school of their own, stay uncoloured
  const school = spell.kind ? undefined : schoolVar(spell.school.name);
  const style = school ? ({ "--school": school } as CSSProperties) : undefined;
  const dot = school && <span className={styles.dot} aria-hidden="true" />;

  if (variant === "full") {
    return (
      <article className={styles.card} style={style}>
        <header className={styles.header}>
          {handle}
          <div className={styles.titleBlock}>
            <Heading className={styles.name}>{spell.name} <Tags spell={spell} /></Heading>
            <p className={styles.sub}>{subtitle(spell)}</p>
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
        <Details spell={spell} />
      </article>
    );
  }

  const meta = [spell.kind ?? spell.school.name, spell.casting_time, spell.range].filter(Boolean).join(" · ");

  return (
    <article className={`${styles.card} ${styles.row}`} style={style}>
      {handle}
      <details className={styles.details}>
        <summary className={`${styles.summary} ${variant === "list" ? styles.listSummary : ""}`}>
          <Heading className={styles.rowName}>{spell.name} <Tags spell={spell} flags /></Heading>
          {variant === "list" ? (
            <>
              <span className={styles.col}>{dot}{spell.kind ?? spell.school.name}</span>
              <span className={styles.col}>{spell.casting_time}</span>
              <span className={styles.col}>{spell.range}</span>
              <span className={styles.col}>{spell.duration}</span>
            </>
          ) : (
            meta && <span className={styles.meta}>{dot}{meta}</span>
          )}
        </summary>
        <div className={styles.expanded}>
          <p className={styles.sub}>{subtitle(spell)}</p>
          <Details spell={spell} />
        </div>
      </details>
      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
