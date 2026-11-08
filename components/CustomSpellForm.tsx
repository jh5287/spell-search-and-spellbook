"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import {
  EMPTY_DRAFT,
  ERROR_ORDER,
  LIMITS,
  draftToSpell,
  isSpellKind,
  spellToDraft,
  validateDraft,
  type Draft,
  type Errors,
} from "@/lib/customSpell";
import { SCHOOLS } from "@/lib/schools";
import { ordinal, type Spell } from "@/lib/spells";
import styles from "./CustomSpellForm.module.css";

interface Props {
  saved: Spell[];
  onAdd: (spell: Spell) => void;
  /** When set, the form edits this entry instead of creating a new one. */
  editing?: Spell;
  onSave?: (spell: Spell) => void;
  onCancel?: () => void;
}

// Suggestions only (via <datalist>): every one of these fields still accepts free text.
const KINDS = ["Spell", "Ability", "Feature", "Item", "Skill", "Trait"];
const CASTING_TIMES = ["Action", "Bonus Action", "Reaction", "1 minute", "10 minutes", "1 hour"];
const RANGES = ["Self", "Touch", "30 feet", "60 feet", "120 feet", "Sight"];
const DURATIONS = ["Instantaneous", "1 round", "1 minute", "10 minutes", "1 hour", "8 hours", "24 hours", "Until dispelled"];

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: (aria: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}

function Field({ id, label, error, required, hint, children }: FieldProps) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && <p id={`${id}-hint`} className={styles.hint}>{hint}</p>}
      {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
    </div>
  );
}

export default function CustomSpellForm({ saved, onAdd, editing, onSave, onCancel }: Props) {
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const [draft, setDraft] = useState<Draft>(() => (editing ? spellToDraft(editing) : EMPTY_DRAFT));
  const [submitted, setSubmitted] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  // Errors only appear after the first "Add" attempt, then update live as the user fixes them.
  const errors: Errors = submitted ? validateDraft(draft, saved, editing?.index) : {};
  const errorCount = Object.keys(errors).length;
  const isSpell = isSpellKind(draft.kind);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setAdded(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const found = validateDraft(draft, saved, editing?.index);
    const first = ERROR_ORDER.find((k) => found[k]);
    if (first) {
      document.getElementById(fieldId(first))?.focus();
      return;
    }
    if (editing) {
      onSave?.(draftToSpell(draft, editing.index));
      return;
    }
    onAdd(draftToSpell(draft));
    setAdded(draft.name.trim());
    // keep the type so several abilities/items can be entered in a row
    setDraft({ ...EMPTY_DRAFT, kind: draft.kind });
    setSubmitted(false);
    document.getElementById(fieldId("name"))?.focus();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {editing ? (
        <p className={styles.intro}>
          Editing <strong>{editing.name}</strong>. Your changes replace the saved version in your book.
        </p>
      ) : (
      <p className={styles.intro}>
        Make your own spell, or add something else you want in your book, like a class ability or an
        item&apos;s power. Only the <strong>name</strong>, <strong>type</strong> and{" "}
        <strong>description</strong> are required{isSpell ? ", plus a level for spells" : ""}.
      </p>
      )}

      <p role="status" className={styles.status}>{added && `Added ${added} to your book.`}</p>
      {errorCount > 0 && (
        <p role="alert" className={styles.summary}>
          Can&apos;t add it yet. Fix the {errorCount === 1 ? "highlighted field" : `${errorCount} highlighted fields`} below.
        </p>
      )}

      <div className={styles.row}>
        <Field id={fieldId("name")} label="Name" required error={errors.name}>
          {(aria) => (
            <input
              {...aria}
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={LIMITS.name + 20}
              autoComplete="off"
            />
          )}
        </Field>
        <Field
          id={fieldId("kind")}
          label="Type"
          required
          error={errors.kind}
          hint="Pick one or type your own."
        >
          {(aria) => (
            <>
              <input
                {...aria}
                list={fieldId("kinds")}
                value={draft.kind}
                onChange={(e) => set("kind", e.target.value)}
                autoComplete="off"
              />
              <datalist id={fieldId("kinds")}>{KINDS.map((k) => <option key={k} value={k} />)}</datalist>
            </>
          )}
        </Field>
      </div>

      {isSpell && (
        <div className={styles.row}>
          <Field id={fieldId("level")} label="Level" required error={errors.level}>
            {(aria) => (
              <select {...aria} value={draft.level} onChange={(e) => set("level", e.target.value)}>
                <option value="">Choose a level…</option>
                <option value="0">Cantrip</option>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{ordinal(n)} level</option>
                ))}
              </select>
            )}
          </Field>
          <Field id={fieldId("school")} label="School of magic">
            {(aria) => (
              <>
                <input
                  {...aria}
                  list={fieldId("schools")}
                  value={draft.school}
                  onChange={(e) => set("school", e.target.value)}
                  maxLength={LIMITS.short}
                  autoComplete="off"
                />
                <datalist id={fieldId("schools")}>{SCHOOLS.map((s) => <option key={s} value={s} />)}</datalist>
              </>
            )}
          </Field>
        </div>
      )}

      <div className={styles.row}>
        <Field id={fieldId("casting")} label="Casting time / activation">
          {(aria) => (
            <>
              <input
                {...aria}
                list={fieldId("castings")}
                value={draft.castingTime}
                onChange={(e) => set("castingTime", e.target.value)}
                maxLength={LIMITS.short}
                autoComplete="off"
              />
              <datalist id={fieldId("castings")}>{CASTING_TIMES.map((s) => <option key={s} value={s} />)}</datalist>
            </>
          )}
        </Field>
        <Field id={fieldId("range")} label="Range">
          {(aria) => (
            <>
              <input
                {...aria}
                list={fieldId("ranges")}
                value={draft.range}
                onChange={(e) => set("range", e.target.value)}
                maxLength={LIMITS.short}
                autoComplete="off"
              />
              <datalist id={fieldId("ranges")}>{RANGES.map((s) => <option key={s} value={s} />)}</datalist>
            </>
          )}
        </Field>
        <Field id={fieldId("duration")} label="Duration">
          {(aria) => (
            <>
              <input
                {...aria}
                list={fieldId("durations")}
                value={draft.duration}
                onChange={(e) => set("duration", e.target.value)}
                maxLength={LIMITS.short}
                autoComplete="off"
              />
              <datalist id={fieldId("durations")}>{DURATIONS.map((s) => <option key={s} value={s} />)}</datalist>
            </>
          )}
        </Field>
      </div>

      <div className={styles.checks}>
        <label><input type="checkbox" checked={draft.concentration} onChange={(e) => set("concentration", e.target.checked)} /> Concentration</label>
        {isSpell && (
          <>
            <label><input type="checkbox" checked={draft.ritual} onChange={(e) => set("ritual", e.target.checked)} /> Ritual</label>
            <span className={styles.checksLabel}>Components:</span>
            <label><input type="checkbox" checked={draft.verbal} onChange={(e) => set("verbal", e.target.checked)} /> V</label>
            <label><input type="checkbox" checked={draft.somatic} onChange={(e) => set("somatic", e.target.checked)} /> S</label>
            <label><input type="checkbox" checked={draft.material} onChange={(e) => set("material", e.target.checked)} /> M</label>
          </>
        )}
      </div>

      {isSpell && draft.material && (
        <Field id={fieldId("material")} label="Material components">
          {(aria) => (
            <input
              {...aria}
              value={draft.materialText}
              onChange={(e) => set("materialText", e.target.value)}
              maxLength={LIMITS.material}
              placeholder="e.g. a pinch of sulfur"
              autoComplete="off"
            />
          )}
        </Field>
      )}

      <Field
        id={fieldId("classes")}
        label={isSpell ? "Classes" : "Source / class"}
        hint="Optional. Separate several with commas."
      >
        {(aria) => (
          <input
            {...aria}
            value={draft.classes}
            onChange={(e) => set("classes", e.target.value)}
            maxLength={LIMITS.short}
            autoComplete="off"
          />
        )}
      </Field>

      <Field id={fieldId("description")} label="Description" required error={errors.description}>
        {(aria) => (
          <textarea
            {...aria}
            rows={6}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={LIMITS.description + 500}
          />
        )}
      </Field>

      {isSpell && (
        <Field id={fieldId("higher")} label="Using a higher-level spell slot">
          {(aria) => (
            <textarea
              {...aria}
              rows={2}
              value={draft.higherLevel}
              onChange={(e) => set("higherLevel", e.target.value)}
              maxLength={LIMITS.higherLevel}
            />
          )}
        </Field>
      )}

      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Add to book"}</button>
        {editing ? (
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setSubmitted(false);
              setAdded(null);
            }}
          >
            Clear form
          </button>
        )}
      </div>
    </form>
  );
}
