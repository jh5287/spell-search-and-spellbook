"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { ABILITY_TEMPLATES, TEMPLATE_BY_ID } from "@/lib/abilityTemplates";
import { RECHARGE_LABELS, RECHARGE_ORDER, type Recharge } from "@/lib/classRules";
import { MAX_COUNT, MAX_NAME, MAX_NOTE, MAX_SOURCE, type Ability } from "@/lib/slots";
import styles from "./AbilityForm.module.css";

export interface AbilityValues {
  name: string;
  source: string;
  max: number;
  recharge: Recharge;
  /** How many come back on a short rest, for "some on short rest". */
  regain: number;
  counter: boolean;
  note: string;
}

interface Props {
  /** The ability being edited; leave out to add a new one. */
  initial?: Ability;
  /** From the levels on the Slots tab, to help fill in "uses equal your proficiency bonus". */
  proficiencyBonus: number | null;
  onSave: (values: AbilityValues) => void;
  onCancel: () => void;
}

const RECHARGE_HELP: Record<Recharge, string> = {
  long: "Comes back after a long rest.",
  short: "Comes back after a short or long rest.",
  shortOne: "Some come back after a short rest; all of them after a long rest.",
  turn: "Comes back when you press New turn. Good for once-per-turn effects and your Reaction.",
  manual: "Never comes back by itself. Tap its dots to restore it.",
};

interface Draft {
  name: string;
  source: string;
  uses: string;
  recharge: Recharge;
  regain: string;
  counter: boolean;
  note: string;
}

const BLANK: Draft = { name: "", source: "", uses: "1", recharge: "long", regain: "1", counter: false, note: "" };

const draftOf = (a?: Ability): Draft =>
  a
    ? { name: a.name, source: a.source ?? "", uses: String(a.max), recharge: a.recharge, regain: String(a.regain ?? 1), counter: !!a.counter, note: a.note ?? "" }
    : BLANK;

/** Whole number in range, or null. */
function wholeNumber(text: string, min: number): number | null {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) && n >= min && n <= MAX_COUNT ? n : null;
}

/** One form to add or edit an ability: what it's called, where it comes from, how many uses, and when they come back. */
export default function AbilityForm({ initial, proficiencyBonus, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial));
  const [errors, setErrors] = useState<{ name?: string; uses?: string; regain?: string }>({});
  const id = useId();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function applyTemplate(templateId: string) {
    const t = TEMPLATE_BY_ID[templateId];
    if (!t) return;
    setDraft({
      name: t.name,
      source: t.source,
      uses: String(t.uses === "pb" ? (proficiencyBonus ?? 2) : t.uses),
      recharge: t.recharge,
      regain: String(t.regain ?? 1),
      counter: !!t.counter,
      note: t.note,
    });
    setErrors({});
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const name = draft.name.trim();
    const max = wholeNumber(draft.uses, 1);
    const regain = draft.recharge === "shortOne" ? wholeNumber(draft.regain, 1) : 1;
    const next = {
      name: name ? undefined : "Give it a name.",
      uses: max === null ? `Uses must be a whole number from 1 to ${MAX_COUNT}.` : undefined,
      regain: regain === null ? `Enter a whole number from 1 to ${MAX_COUNT}.` : undefined,
    };
    setErrors(next);
    if (next.name || next.uses || next.regain || max === null || regain === null) return;
    onSave({ name, source: draft.source.trim(), max, recharge: draft.recharge, regain, counter: draft.counter, note: draft.note.trim() });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} onKeyDown={onKeyDown} noValidate aria-label={initial ? `Edit ${initial.name}` : "Add an ability"}>
      <h3 className={styles.title}>{initial ? `Edit ${initial.name}` : "Add an ability"}</h3>

      {!initial && (
        <label className={styles.field}>
          Start from a template (optional)
          <select value="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">Choose one to fill this in…</option>
            {(["Patterns", "Feats"] as const).map((group) => (
              <optgroup key={group} label={group === "Feats" ? "Feats (2024 Player's Handbook)" : "Common patterns"}>
                {ABILITY_TEMPLATES.filter((t) => t.group === group).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${id}-name`}>Name</label>
          <input
            id={`${id}-name`}
            autoFocus
            value={draft.name}
            maxLength={MAX_NAME}
            placeholder="e.g. Blood Curse, Luck Points, Reaction"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            onChange={(e) => set({ name: e.target.value })}
          />
          {errors.name && (
            <p id={`${id}-name-error`} role="alert" className={styles.error}>
              {errors.name}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-source`}>Where it comes from (optional)</label>
          <input
            id={`${id}-source`}
            value={draft.source}
            maxLength={MAX_SOURCE}
            placeholder="A class, feat, item or homebrew source"
            onChange={(e) => set({ source: e.target.value })}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${id}-uses`}>Uses</label>
          <input
            id={`${id}-uses`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_COUNT}
            value={draft.uses}
            aria-invalid={!!errors.uses}
            aria-describedby={`${id}-uses-hint`}
            onChange={(e) => set({ uses: e.target.value })}
          />
          <p id={`${id}-uses-hint`} className={errors.uses ? styles.error : styles.hint} role={errors.uses ? "alert" : undefined}>
            {errors.uses ??
              (proficiencyBonus === null
                ? "Set up your class above to see your proficiency bonus here."
                : `Your proficiency bonus is +${proficiencyBonus}.`)}{" "}
            {!errors.uses && proficiencyBonus !== null && (
              <button type="button" className={styles.link} onClick={() => set({ uses: String(proficiencyBonus) })}>
                Use it
              </button>
            )}
          </p>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-recharge`}>Comes back</label>
          <select id={`${id}-recharge`} value={draft.recharge} aria-describedby={`${id}-recharge-hint`} onChange={(e) => set({ recharge: e.target.value as Recharge })}>
            {RECHARGE_ORDER.map((r) => (
              <option key={r} value={r}>
                {RECHARGE_LABELS[r]}
              </option>
            ))}
          </select>
          <p id={`${id}-recharge-hint`} className={styles.hint}>
            {RECHARGE_HELP[draft.recharge]}
          </p>
        </div>
      </div>

      {draft.recharge === "shortOne" && (
        <div className={styles.field}>
          <label htmlFor={`${id}-regain`}>Regained on a short rest</label>
          <input
            id={`${id}-regain`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_COUNT}
            value={draft.regain}
            aria-invalid={!!errors.regain}
            onChange={(e) => set({ regain: e.target.value })}
          />
          {errors.regain && (
            <p role="alert" className={styles.error}>
              {errors.regain}
            </p>
          )}
        </div>
      )}

      <label className={styles.check}>
        <input type="checkbox" checked={draft.counter} onChange={(e) => set({ counter: e.target.checked })} />
        Show as a number instead of dots
        <span className={styles.hint}> (better for big pools)</span>
      </label>

      <div className={styles.field}>
        <label htmlFor={`${id}-note`}>What it does (optional)</label>
        <textarea
          id={`${id}-note`}
          rows={3}
          value={draft.note}
          maxLength={MAX_NOTE}
          placeholder="A reminder for yourself: range, damage, the rule text…"
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>

      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary">
          {initial ? "Save changes" : "Add ability"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
