"use client";

import { useState } from "react";
import { rechargeText, type ClassEntry, type Mods } from "@/lib/classRules";
import { slotTracker } from "@/lib/characters";
import { useLocalStore } from "@/lib/localStore";
import {
  MAX_COUNT,
  addAbility,
  addFeat,
  addSlotLevel,
  applyClasses,
  hasTracker,
  featNameOf,
  hasTurnAbilities,
  isCustomId,
  longRest,
  newTurn,
  proficiencyBonusFor,
  removeAbility,
  removeSlotLevel,
  setPact,
  setSlotMax,
  setSlotUsed,
  shortRest,
  updateAbility,
  updatePact,
  type Ability,
  type Cast,
} from "@/lib/slots";
import { ordinal } from "@/lib/spells";
import type { FeatTemplate } from "@/lib/abilityTemplates";
import AbilityForm, { type AbilityValues } from "./AbilityForm";
import ClassSetup from "./ClassSetup";
import FeatPicker from "./FeatPicker";
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

/** One ability: its name and rules, a meter to spend and restore it, and (for your own) Edit and Remove. */
function AbilityCard({ a, manageable, hideSource, onUsed, onEdit, onRemove }: { a: Ability; manageable: boolean; hideSource?: boolean; onUsed: (used: number) => void; onEdit: () => void; onRemove: () => void }) {
  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <span className={styles.itemName}>{a.name}</span>
        {a.source && !hideSource && <span className={styles.meta}>{a.source}</span>}
      </div>
      <p className={styles.meta}>{rechargeText(a.recharge, a.regain)}</p>
      {a.note && <p className={styles.note}>{a.note}</p>}
      <Meter label={a.name} max={a.max} used={a.used} counter={a.counter} onUsed={onUsed} />
      {manageable && (
        <div className={styles.manage}>
          <button type="button" className="btn" aria-label={`Edit ${a.name}`} onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn" aria-label={`Remove ${a.name}`} onClick={onRemove}>
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function SlotTracker() {
  const [tracker, setTracker] = useLocalStore(slotTracker);
  const [customizing, setCustomizing] = useState(false);
  const [status, setStatus] = useState("");
  const [panel, setPanel] = useState<null | "ability" | "feat" | "feat-custom">(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const hasContent = hasTracker(tracker);
  const missingLevels = SPELL_LEVELS.filter((l) => !tracker.slots.some((s) => s.level === l));
  const showSlots = tracker.slots.length > 0 || tracker.pact !== null || customizing;
  const classAbilities = tracker.abilities.filter((a) => !isCustomId(a.id));
  const ownAbilities = tracker.abilities.filter((a) => isCustomId(a.id) && featNameOf(a) === null);
  const featAbilities = tracker.abilities.filter((a) => isCustomId(a.id) && featNameOf(a) !== null);
  // feats in the order they were added, each with its own trackers underneath
  const featGroups = [...new Set(featAbilities.map((a) => featNameOf(a)!))].map((name) => ({
    name,
    abilities: featAbilities.filter((a) => featNameOf(a) === name),
  }));
  const pb = proficiencyBonusFor(tracker.classes);

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

  function toPatch(v: AbilityValues) {
    return { name: v.name, source: v.source, note: v.note, max: v.max, recharge: v.recharge, counter: v.counter, kind: v.kind, regain: v.recharge === "shortOne" && v.regain > 1 ? v.regain : undefined };
  }

  function saveNew(v: AbilityValues) {
    setTracker((prev) => addAbility(prev, toPatch(v)));
    setPanel(null);
    setStatus(`Added ${v.name}.`);
  }

  function saveEdit(id: string, v: AbilityValues) {
    setTracker((prev) => updateAbility(prev, id, toPatch(v)));
    setEditingId(null);
    setStatus(`Saved ${v.name}.`);
  }

  function pickFeat(feat: FeatTemplate) {
    setTracker((prev) => addFeat(prev, feat, pb));
    setStatus(`Added ${feat.name}.`);
  }

  function removeOne(a: Ability) {
    if (!window.confirm(`Remove ${a.name}?`)) return;
    setTracker((prev) => removeAbility(prev, a.id));
    if (editingId === a.id) setEditingId(null);
    setStatus(`Removed ${a.name}.`);
  }

  /** An ability's card, or its edit form in its place. */
  function renderAbility(a: Ability, hideSource = false) {
    if (editingId === a.id) {
      return (
        <li key={a.id} className={styles.editing}>
          <AbilityForm initial={a} proficiencyBonus={pb} onSave={(v) => saveEdit(a.id, v)} onCancel={() => setEditingId(null)} />
        </li>
      );
    }
    return (
      <AbilityCard
        key={a.id}
        a={a}
        hideSource={hideSource}
        manageable={isCustomId(a.id) || customizing}
        onUsed={(u) => setTracker((t) => updateAbility(t, a.id, { used: u }))}
        onEdit={() => {
          setEditingId(a.id);
          setPanel(null);
        }}
        onRemove={() => removeOne(a)}
      />
    );
  }

  return (
    <div className={styles.container}>
      <ClassSetup key={JSON.stringify([tracker.classes, tracker.mods])} tracker={tracker} onApply={apply} />

      <div className={styles.toolbar}>
        {hasTurnAbilities(tracker) && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setTracker(newTurn);
              setStatus("New turn: your once-per-turn abilities and Reaction are ready.");
            }}
          >
            New turn
          </button>
        )}
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
        <p>Nothing is tracked yet. Set up your character above, or add your own abilities below.</p>
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

      <section className={styles.section} aria-labelledby="abilities-heading">
        <div className={styles.sectionHead}>
          <h2 id="abilities-heading" className={styles.heading}>
            Abilities
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            disabled={panel === "ability"}
            onClick={() => {
              setPanel("ability");
              setEditingId(null);
            }}
          >
            + Add ability
          </button>
        </div>

        {panel === "ability" && (
          <div className={styles.formWrap}>
            <AbilityForm proficiencyBonus={pb} onSave={saveNew} onCancel={() => setPanel(null)} />
          </div>
        )}

        {classAbilities.length > 0 && <ul className={styles.list}>{classAbilities.map((a) => renderAbility(a))}</ul>}

        {ownAbilities.length > 0 && (
          <>
            <h3 className={styles.subheading}>Your own abilities</h3>
            <ul className={styles.list}>{ownAbilities.map((a) => renderAbility(a))}</ul>
          </>
        )}

        {tracker.abilities.length === 0 && panel === null && (
          <p className={styles.hint}>
            Class abilities appear when you set up your character above. For a homebrew class, an older edition, a feat or an item,
            add your own: anything with a limited number of uses.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="feats-heading">
        <div className={styles.sectionHead}>
          <h2 id="feats-heading" className={styles.heading}>
            Feats
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            disabled={panel === "feat" || panel === "feat-custom"}
            onClick={() => {
              setPanel("feat");
              setEditingId(null);
            }}
          >
            + Add feat
          </button>
        </div>

        {panel === "feat" && (
          <div className={styles.formWrap}>
            <FeatPicker tracker={tracker} proficiencyBonus={pb} onAdd={pickFeat} onCustom={() => setPanel("feat-custom")} onClose={() => setPanel(null)} />
          </div>
        )}
        {panel === "feat-custom" && (
          <div className={styles.formWrap}>
            <AbilityForm kind="feat" proficiencyBonus={pb} onSave={saveNew} onCancel={() => setPanel("feat")} />
          </div>
        )}

        {featGroups.map((group) => (
          <div key={group.name} className={styles.featGroup}>
            <h3 className={styles.subheading}>{group.name}</h3>
            <ul className={styles.list}>{group.abilities.map((a) => renderAbility(a, true))}</ul>
          </div>
        ))}

        {featGroups.length === 0 && panel !== "feat" && panel !== "feat-custom" && (
          <p className={styles.hint}>
            Track the uses and once-per-turn effects that feats give you, like Lucky or Savage Attacker. They refresh on short
            and long rests, or with New turn, just like your class abilities.
          </p>
        )}
      </section>
    </div>
  );
}
