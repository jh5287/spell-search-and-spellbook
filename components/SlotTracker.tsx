"use client";

import { useState } from "react";
import { RECHARGE_LABELS, type ClassEntry, type Mods, type Recharge } from "@/lib/classRules";
import { useLocalStore } from "@/lib/localStore";
import {
  MAX_COUNT,
  MAX_NAME,
  addAbility,
  addSlotLevel,
  applyClasses,
  hasTracker,
  longRest,
  removeAbility,
  removeSlotLevel,
  setPact,
  setSlotMax,
  setSlotUsed,
  shortRest,
  slotTracker,
  updateAbility,
  updatePact,
  type Cast,
} from "@/lib/slots";
import { ordinal } from "@/lib/spells";
import ClassSetup from "./ClassSetup";
import styles from "./SlotTracker.module.css";

interface MeterProps {
  label: string;
  max: number;
  used: number;
  counter?: boolean;
  onUsed: (used: number) => void;
}

/** A row of pips (click one to spend or restore it), or a number box for big pools. */
function Meter({ label, max, used, counter, onUsed }: MeterProps) {
  const left = Math.max(0, max - used);

  if (counter || max > 20) {
    return (
      <div className={styles.counter}>
        <button type="button" className="btn" aria-label={`Spend 1 ${label}`} disabled={left === 0} onClick={() => onUsed(used + 1)}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={left}
          aria-label={`${label} remaining`}
          onChange={(e) => onUsed(max - Number(e.target.value))}
        />
        <span>/ {max}</span>
        <button type="button" className="btn" aria-label={`Restore 1 ${label}`} disabled={left === max} onClick={() => onUsed(used - 1)}>
          +
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pips} role="group" aria-label={`${label}: ${left} of ${max} left`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < left;
        return (
          <button
            key={i}
            type="button"
            className={`${styles.pip} ${filled ? styles.filled : ""}`}
            aria-label={filled ? `Spend ${label}` : `Restore ${label}`}
            onClick={() => onUsed(filled ? used + 1 : used - 1)}
          />
        );
      })}
      <span className={styles.left}>
        {left}/{max}
      </span>
    </div>
  );
}

/** The spells that went into this slot level since the last rest. */
function CastList({ casts, slotLevel }: { casts?: Cast[]; slotLevel: number }) {
  if (!casts?.length) return null;
  return (
    <p className={styles.note}>
      <strong>Spent on:</strong> {casts.map((c) => (c.level < slotLevel ? `${c.name} (upcast)` : c.name)).join(", ")}
    </p>
  );
}

function NumberBox({ label, value, min = 0, max = MAX_COUNT, onChange }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={styles.num}
      min={min}
      max={max}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
    />
  );
}

function RechargeSelect({ label, value, onChange }: { label: string; value: Recharge; onChange: (r: Recharge) => void }) {
  return (
    <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value as Recharge)}>
      {(Object.keys(RECHARGE_LABELS) as Recharge[]).map((r) => (
        <option key={r} value={r}>
          {RECHARGE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function SlotTracker() {
  const [tracker, setTracker] = useLocalStore(slotTracker);
  const [customizing, setCustomizing] = useState(false);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState({ name: "", max: 1, recharge: "long" as Recharge, counter: false });

  const hasContent = hasTracker(tracker);
  const missingLevels = SPELL_LEVELS.filter((l) => !tracker.slots.some((s) => s.level === l));
  const showSlots = tracker.slots.length > 0 || tracker.pact !== null || customizing;
  const showAbilities = tracker.abilities.length > 0 || customizing;

  function apply(classes: ClassEntry[], mods: Mods) {
    if (
      hasContent &&
      !window.confirm(
        "Replace your class spell slots and abilities with the rules for these classes? Spent counts are kept, and abilities you added yourself stay.",
      )
    ) {
      return;
    }
    setTracker((prev) => applyClasses(prev, classes, mods));
    setStatus("Slots and abilities updated.");
  }

  function addCustom() {
    if (!draft.name.trim()) return;
    setTracker((prev) => addAbility(prev, { name: draft.name, max: draft.max, recharge: draft.recharge, counter: draft.counter }));
    setDraft((d) => ({ ...d, name: "", max: 1 }));
  }

  return (
    <div className={styles.container}>
      <ClassSetup key={JSON.stringify([tracker.classes, tracker.mods])} tracker={tracker} onApply={apply} />

      <div className={styles.toolbar}>
        <button
          className="btn"
          disabled={!hasContent}
          onClick={() => {
            setTracker(shortRest);
            setStatus("Short rest: Pact Magic slots and short-rest abilities restored.");
          }}
        >
          Short rest
        </button>
        <button
          className="btn"
          disabled={!hasContent}
          onClick={() => {
            setTracker(longRest);
            setStatus("Long rest: everything restored.");
          }}
        >
          Long rest
        </button>
        <button className="btn" aria-pressed={customizing} onClick={() => setCustomizing((c) => !c)}>
          {customizing ? "Done customizing" : "Customize"}
        </button>
      </div>
      <p role="status" className={styles.status}>
        {status}
      </p>

      {!hasContent && !customizing && (
        <p>Nothing is tracked yet. Set up your character above, or use Customize to add slots and abilities yourself.</p>
      )}
      {customizing && (
        <p className={styles.hint}>
          Change how many of each you have, rename or remove anything, and add your own. Updating your character
          above rebuilds the class slots and abilities but keeps the ones you add here.
        </p>
      )}

      {showSlots && (
        <section className={styles.section} aria-labelledby="slots-heading">
          <h2 id="slots-heading" className={styles.heading}>
            Spell Slots
          </h2>
          <ul className={styles.list}>
            {tracker.slots.map((s) => {
              const label = `${ordinal(s.level)}-level slot`;
              return (
                <li key={s.level} className={styles.item}>
                  <div className={styles.itemHead}>
                    <span className={styles.itemName}>{ordinal(s.level)} level</span>
                  </div>
                  <Meter label={label} max={s.max} used={s.used} onUsed={(u) => setTracker((t) => setSlotUsed(t, s.level, u))} />
                  <CastList casts={s.casts} slotLevel={s.level} />
                  {customizing && (
                    <div className={styles.edit}>
                      <label>
                        Slots
                        <NumberBox label={`${ordinal(s.level)}-level slots total`} value={s.max} onChange={(n) => setTracker((t) => setSlotMax(t, s.level, n))} />
                      </label>
                      <button className="btn" aria-label={`Remove ${label}s`} onClick={() => setTracker((t) => removeSlotLevel(t, s.level))}>
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}

            {tracker.pact && (
              <li className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.itemName}>Pact Magic · {ordinal(tracker.pact.level)} level</span>
                  <span className={styles.meta}>Short or long rest</span>
                </div>
                <Meter
                  label="Pact Magic slot"
                  max={tracker.pact.max}
                  used={tracker.pact.used}
                  onUsed={(u) => setTracker((t) => updatePact(t, { used: u }))}
                />
                <CastList casts={tracker.pact.casts} slotLevel={tracker.pact.level} />
                {customizing && (
                  <div className={styles.edit}>
                    <label>
                      Slots
                      <NumberBox label="Pact Magic slots total" value={tracker.pact.max} onChange={(n) => setTracker((t) => updatePact(t, { max: n }))} />
                    </label>
                    <label>
                      Slot level
                      <NumberBox label="Pact Magic slot level" value={tracker.pact.level} min={1} max={9} onChange={(n) => setTracker((t) => updatePact(t, { level: n }))} />
                    </label>
                    <button className="btn" onClick={() => setTracker((t) => setPact(t, null))}>
                      Remove
                    </button>
                  </div>
                )}
              </li>
            )}
          </ul>

          {customizing && (
            <div className={styles.addRow}>
              {missingLevels.length > 0 && (
                <select
                  value=""
                  aria-label="Add a spell slot level"
                  onChange={(e) => setTracker((t) => addSlotLevel(t, Number(e.target.value)))}
                >
                  <option value="">Add a slot level…</option>
                  {missingLevels.map((l) => (
                    <option key={l} value={l}>
                      {ordinal(l)} level
                    </option>
                  ))}
                </select>
              )}
              {!tracker.pact && (
                <button className="btn" onClick={() => setTracker((t) => setPact(t, { level: 1, max: 1, used: 0 }))}>
                  Add Pact Magic slots
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {showAbilities && (
        <section className={styles.section} aria-labelledby="abilities-heading">
          <h2 id="abilities-heading" className={styles.heading}>
            Abilities
          </h2>
          <ul className={styles.list}>
            {tracker.abilities.map((a) => (
              <li key={a.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <span className={styles.itemName}>{a.name}</span>
                  {a.source && <span className={styles.meta}>{a.source}</span>}
                </div>
                <p className={styles.meta}>{RECHARGE_LABELS[a.recharge]}</p>
                {a.note && <p className={styles.note}>{a.note}</p>}
                <Meter label={a.name} max={a.max} used={a.used} counter={a.counter} onUsed={(u) => setTracker((t) => updateAbility(t, a.id, { used: u }))} />
                {customizing && (
                  <div className={styles.edit}>
                    <input
                      type="text"
                      className={styles.nameInput}
                      value={a.name}
                      maxLength={MAX_NAME}
                      aria-label={`Name of ${a.name}`}
                      onChange={(e) => setTracker((t) => updateAbility(t, a.id, { name: e.target.value }))}
                    />
                    <label>
                      Uses
                      <NumberBox label={`${a.name} total uses`} value={a.max} onChange={(n) => setTracker((t) => updateAbility(t, a.id, { max: n }))} />
                    </label>
                    <RechargeSelect label={`${a.name} recharge`} value={a.recharge} onChange={(r) => setTracker((t) => updateAbility(t, a.id, { recharge: r }))} />
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={!!a.counter}
                        onChange={(e) => setTracker((t) => updateAbility(t, a.id, { counter: e.target.checked }))}
                      />
                      Number box
                    </label>
                    <button className="btn" aria-label={`Remove ${a.name}`} onClick={() => setTracker((t) => removeAbility(t, a.id))}>
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {customizing && (
            <form
              className={styles.addForm}
              onSubmit={(e) => {
                e.preventDefault();
                addCustom();
              }}
            >
              <h3 className={styles.subheading}>Add your own</h3>
              <div className={styles.edit}>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="Ability name, e.g. Bardic Inspiration"
                  maxLength={MAX_NAME}
                  value={draft.name}
                  aria-label="New ability name"
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
                <label>
                  Uses
                  <NumberBox label="New ability total uses" value={draft.max} onChange={(n) => setDraft((d) => ({ ...d, max: n }))} />
                </label>
                <RechargeSelect label="New ability recharge" value={draft.recharge} onChange={(r) => setDraft((d) => ({ ...d, recharge: r }))} />
                <label className={styles.check}>
                  <input type="checkbox" checked={draft.counter} onChange={(e) => setDraft((d) => ({ ...d, counter: e.target.checked }))} />
                  Number box
                </label>
                <button type="submit" className="btn btn-primary" disabled={!draft.name.trim() || draft.max < 1}>
                  Add
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
