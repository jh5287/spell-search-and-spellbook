"use client";

import { useState } from "react";
import { castOptions, defaultCastOption, isCastable, type CastOption, type Tracker } from "@/lib/slots";
import type { Spell } from "@/lib/spells";
import styles from "./CastControl.module.css";

interface Props {
  spell: Spell;
  tracker: Tracker;
  onCast: (spell: Spell, option: CastOption) => void;
}

/** "Cast at" menu plus a Use button. It starts on the spell's own level; pick a higher one to upcast. */
export default function CastControl({ spell, tracker, onCast }: Props) {
  const [choice, setChoice] = useState("");
  const options = isCastable(spell) ? castOptions(tracker, spell.level) : [];
  const selected = options.find((o) => o.value === choice) ?? defaultCastOption(options, spell.level);
  if (!selected) return null;

  const optionLabel = (o: CastOption) =>
    `${o.label}${o.level > spell.level ? " (upcast)" : ""} · ${o.left} left`;

  return (
    <span className={styles.cast}>
      <select
        className={styles.select}
        value={selected.value}
        aria-label={`Cast ${spell.name} at`}
        onChange={(e) => setChoice(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
      <button
        className="btn btn-primary"
        aria-label={`Use ${spell.name} with ${selected.label}`}
        title={selected.left === 0 ? "No slots left at this level. Pick another." : undefined}
        disabled={selected.left === 0}
        onClick={() => onCast(spell, selected)}
      >
        Use
      </button>
    </span>
  );
}
