"use client";

import { useState } from "react";
import {
  CLASSES,
  CLASS_BY_ID,
  castingSummary,
  clampLevel,
  neededMods,
  planSlots,
  type ClassEntry,
  type ClassId,
  type ModName,
  type Mods,
} from "@/lib/classRules";
import { hasTracker, type Tracker } from "@/lib/slots";
import { ordinal } from "@/lib/spells";
import styles from "./SlotTracker.module.css";

interface Row {
  classId: ClassId | "";
  subclassId: string;
  /** NaN while the box is empty. */
  level: number;
}

const MOD_LABELS: Record<ModName, string> = { wis: "Wisdom modifier", cha: "Charisma modifier" };

function toEntries(rows: Row[]): ClassEntry[] {
  return rows.flatMap((r) =>
    r.classId ? [{ classId: r.classId, level: clampLevel(r.level), subclassId: r.subclassId || undefined }] : [],
  );
}

interface Props {
  tracker: Tracker;
  onApply: (classes: ClassEntry[], mods: Mods) => void;
}

export default function ClassSetup({ tracker, onApply }: Props) {
  const configured = hasTracker(tracker);
  const [open, setOpen] = useState(!configured);
  const [rows, setRows] = useState<Row[]>(
    tracker.classes.length
      ? tracker.classes.map((c) => ({ classId: c.classId, subclassId: c.subclassId ?? "", level: c.level }))
      : [{ classId: "", subclassId: "", level: 1 }],
  );
  const [mods, setMods] = useState<Mods>(tracker.mods);

  const entries = toEntries(rows);
  const totalLevel = entries.reduce((sum, e) => sum + e.level, 0);
  const plan = planSlots(entries);
  const casting = castingSummary(entries);
  const modsNeeded = neededMods(entries);

  const problem =
    entries.length === 0 ? "Choose a class to continue." : totalLevel > 20 ? `Total level is ${totalLevel}; the maximum is 20.` : null;

  const heading = tracker.classes.length
    ? tracker.classes.map((c) => `${CLASS_BY_ID[c.classId].name} ${c.level}`).join(" / ")
    : "Not set up yet";

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const slotText = plan.slots
    .flatMap((n, i) => (n ? [`${ordinal(i + 1)} × ${n}`] : []))
    .join(", ");

  return (
    <details className={styles.setup} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={styles.setupSummary}>
        Character: <strong>{heading}</strong>
      </summary>

      <form
        className={styles.setupForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem) onApply(entries, mods);
        }}
      >
        <p className={styles.hint}>
          Pick your class and level to fill in your spell slots and class abilities from the 2024 rules. You can adjust
          everything afterwards with Customize.
        </p>

        {rows.map((row, i) => {
          const cls = row.classId ? CLASS_BY_ID[row.classId] : null;
          const taken = new Set(rows.filter((_, k) => k !== i).map((r) => r.classId));
          return (
            <fieldset key={i} className={styles.classRow}>
              <legend className={styles.srOnly}>Class {i + 1}</legend>
              <label className={styles.field}>
                Class
                <select
                  value={row.classId}
                  onChange={(e) => setRow(i, { classId: e.target.value as ClassId | "", subclassId: "" })}
                >
                  <option value="">Choose a class…</option>
                  {CLASSES.filter((c) => !taken.has(c.id)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Level
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  value={Number.isNaN(row.level) ? "" : row.level}
                  onChange={(e) => setRow(i, { level: e.target.value === "" ? NaN : Number(e.target.value) })}
                />
              </label>
              {cls && cls.subclasses.length > 0 && (
                <label className={styles.field}>
                  Subclass (level 3+)
                  <select value={row.subclassId} onChange={(e) => setRow(i, { subclassId: e.target.value })}>
                    <option value="">None / not listed</option>
                    {cls.subclasses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.caster ? " (spellcasting)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {rows.length > 1 && (
                <button
                  type="button"
                  className="btn"
                  aria-label={`Remove class ${i + 1}`}
                  onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}
                >
                  Remove
                </button>
              )}
            </fieldset>
          );
        })}

        {rows.length < CLASSES.length && (
          <div>
            <button
              type="button"
              className="btn"
              onClick={() => setRows((prev) => [...prev, { classId: "", subclassId: "", level: 1 }])}
            >
              + Add another class (multiclass)
            </button>
          </div>
        )}

        {modsNeeded.length > 0 && (
          <div className={styles.modRow}>
            {modsNeeded.map((m) => (
              <label key={m} className={styles.field}>
                {MOD_LABELS[m]}
                <input
                  type="number"
                  inputMode="numeric"
                  min={-5}
                  max={10}
                  value={Number.isNaN(mods[m]) ? "" : mods[m]}
                  onChange={(e) => setMods((prev) => ({ ...prev, [m]: e.target.value === "" ? NaN : Number(e.target.value) }))}
                />
              </label>
            ))}
            <p className={styles.hint}>
              Some features have uses equal to an ability modifier (minimum 1), like Bardic Inspiration or Tireless.
            </p>
          </div>
        )}

        {entries.length > 0 && (
          <div className={styles.preview} aria-live="polite">
            <p>
              <strong>Spell slots:</strong>{" "}
              {slotText || "none"}
              {plan.method === "multiclass" && ` (Multiclass Spellcaster table, caster level ${plan.casterLevel})`}
            </p>
            {plan.pact && (
              <p>
                <strong>Pact Magic:</strong> {plan.pact.count} × {ordinal(plan.pact.level)}-level slot
                {plan.pact.count === 1 ? "" : "s"}, back on a short rest
              </p>
            )}
            {casting.map((c) => (
              <p key={c.className}>
                <strong>
                  {c.className} {c.level}:
                </strong>{" "}
                {[c.cantrips !== undefined && `${c.cantrips} cantrips`, c.prepared !== undefined && `${c.prepared} prepared spells`]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ))}
          </div>
        )}

        {problem && entries.length > 0 && <p className={styles.error}>{problem}</p>}
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!!problem || modsNeeded.some((m) => Number.isNaN(mods[m]))}
          >
            {configured ? "Update slots & abilities" : "Set up slots & abilities"}
          </button>
        </div>
      </form>
    </details>
  );
}
