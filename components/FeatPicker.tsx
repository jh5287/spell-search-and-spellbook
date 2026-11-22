"use client";

import { useId, useState } from "react";
import { FEAT_TEMPLATES, type FeatTemplate, type FeatTracker } from "@/lib/abilityTemplates";
import { rechargeText } from "@/lib/classRules";
import { hasFeat, type Tracker } from "@/lib/slots";
import styles from "./FeatPicker.module.css";

interface Props {
  tracker: Tracker;
  proficiencyBonus: number | null;
  onAdd: (feat: FeatTemplate) => void;
  onCustom: () => void;
  onClose: () => void;
}

function describe(tr: FeatTracker, proficiencyBonus: number | null): string {
  if (tr.shared) return "Uses your Reaction, which is tracked once for all of them";
  const uses = tr.uses === "pb" ? `${proficiencyBonus ?? 2} uses (proficiency bonus)` : tr.uses === 1 ? "1 use" : `${tr.uses} uses`;
  return `${tr.name}: ${uses}, ${rechargeText(tr.recharge, tr.regain).toLowerCase()}`;
}

/** The 2024 Player's Handbook feats that give you something to keep count of, ready to add in one tap. */
export default function FeatPicker({ tracker, proficiencyBonus, onAdd, onCustom, onClose }: Props) {
  const [query, setQuery] = useState("");
  const id = useId();
  const q = query.trim().toLowerCase();
  const shown = FEAT_TEMPLATES.filter((f) => !q || f.name.toLowerCase().includes(q) || f.trackers.some((t) => t.name.toLowerCase().includes(q)));

  return (
    <section className={styles.picker} aria-label="Add a feat" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <h3 className={styles.title}>Add a feat</h3>
      <p className={styles.hint}>
        Feats that give you something to keep count of. Each one&apos;s trackers come back on a rest or a new turn like your other
        abilities, and you can edit them afterwards.
      </p>
      <label className={styles.search} htmlFor={`${id}-search`}>
        Search feats
        <input id={`${id}-search`} type="search" autoFocus value={query} placeholder="e.g. Lucky, reaction, once per turn" onChange={(e) => setQuery(e.target.value)} />
      </label>

      <ul className={styles.list}>
        {shown.map((f) => {
          const added = hasFeat(tracker, f);
          return (
            <li key={f.id} className={styles.row}>
              <div className={styles.info}>
                <span className={styles.name}>{f.name}</span>
                {f.trackers.map((t) => (
                  <span key={t.name} className={styles.meta}>
                    {describe(t, proficiencyBonus)}
                  </span>
                ))}
              </div>
              <button type="button" className="btn" disabled={added} aria-label={added ? `${f.name} is already tracked` : `Add ${f.name}`} onClick={() => onAdd(f)}>
                {added ? "Added" : "Add"}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className={styles.hint}>No feat matches that. Use &quot;Add a feat of your own&quot; below.</li>}
      </ul>

      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={onCustom}>
          Add a feat of your own…
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
