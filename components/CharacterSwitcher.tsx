"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  MAX_CHARACTERS,
  MAX_CHARACTER_NAME,
  activeCharacterId,
  characterBook,
  classLine,
  createCharacter,
  removeCharacter,
  renameCharacter,
  resolveActive,
  switchCharacter,
  type Character,
} from "@/lib/characters";
import { useLocalStore } from "@/lib/localStore";
import { CharacterIcon } from "./icons";
import styles from "./CharacterSwitcher.module.css";

interface Props {
  /** Called when a different character becomes the open one, so the page can drop anything tied to the old one. */
  onSwitched: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Each character has their own spell book, class, level and slots. This is how you move between them. */
export default function CharacterSwitcher({ onSwitched }: Props) {
  const [list, setList] = useLocalStore(characterBook);
  const [activeId] = useLocalStore(activeCharacterId);
  const active = resolveActive(list, activeId);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const atMax = list.characters.length >= MAX_CHARACTERS;

  // close on a click elsewhere, and on Escape (which first backs out of a rename)
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (renaming) setRenaming(null);
      else {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, renaming]);

  function pick(c: Character) {
    if (c.id !== active.id) {
      switchCharacter(c.id);
      onSwitched();
      setAnnouncement(`Switched to ${c.name}.`);
    }
    setOpen(false);
    buttonRef.current?.focus();
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (atMax) return;
    const name = newName.trim() || `Character ${list.characters.length + 1}`;
    createCharacter(name);
    setNewName("");
    onSwitched();
    setAnnouncement(`Created ${name} and switched to it.`);
    setOpen(false);
  }

  function duplicate(c: Character) {
    if (atMax) return;
    createCharacter(`${c.name} copy`, c);
    onSwitched();
    setAnnouncement(`Copied ${c.name} and switched to the copy.`);
    setOpen(false);
  }

  function remove(c: Character) {
    if (list.characters.length <= 1) return;
    if (!window.confirm(`Delete ${c.name} and its ${plural(c.spells.length, "spell")}? This can't be undone.`)) return;
    const wasOpen = c.id === active.id;
    removeCharacter(c.id);
    if (wasOpen) onSwitched();
    setAnnouncement(`Deleted ${c.name}.`);
  }

  function saveRename(e: FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    setList((prev) => renameCharacter(prev, renaming.id, renaming.draft));
    setRenaming(null);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <CharacterIcon />
        <span className={styles.triggerText}>
          <span className={styles.name}>{active.name}</span>
          <span className={styles.meta}>{classLine(active) || "No class set yet"}</span>
        </span>
        <span className={styles.caret} aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
        <span className={styles.srOnly}>Switch character</span>
      </button>
      <span role="status" className={styles.srOnly}>
        {announcement}
      </span>

      {open && (
        <div id={panelId} className={styles.panel}>
          <ul className={styles.list} aria-label="Your characters">
            {list.characters.map((c) => {
              const isOpen = c.id === active.id;
              return (
                <li key={c.id} className={`${styles.row} ${isOpen ? styles.open : ""}`}>
                  {renaming?.id === c.id ? (
                    <form className={styles.renameForm} onSubmit={saveRename}>
                      <input
                        autoFocus
                        className={styles.input}
                        value={renaming.draft}
                        maxLength={MAX_CHARACTER_NAME}
                        aria-label={`New name for ${c.name}`}
                        onChange={(e) => setRenaming({ id: c.id, draft: e.target.value })}
                      />
                      <button type="submit" className="btn btn-primary">
                        Save
                      </button>
                      <button type="button" className="btn" onClick={() => setRenaming(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <button type="button" className={styles.pick} aria-current={isOpen ? "true" : undefined} onClick={() => pick(c)}>
                        <span className={styles.pickName}>
                          {c.name}
                          {isOpen && <span className={styles.badge}>Open</span>}
                        </span>
                        <span className={styles.meta}>
                          {classLine(c) || "No class set yet"} · {plural(c.spells.length, "spell")}
                        </span>
                      </button>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className="btn"
                          aria-label={`Rename ${c.name}`}
                          onClick={() => setRenaming({ id: c.id, draft: c.name })}
                        >
                          Rename
                        </button>
                        <button type="button" className="btn" aria-label={`Duplicate ${c.name}`} disabled={atMax} onClick={() => duplicate(c)}>
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="btn"
                          aria-label={`Delete ${c.name}`}
                          disabled={list.characters.length <= 1}
                          title={list.characters.length <= 1 ? "You always need one character" : undefined}
                          onClick={() => remove(c)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <form className={styles.addForm} onSubmit={add}>
            <input
              className={styles.input}
              value={newName}
              maxLength={MAX_CHARACTER_NAME}
              placeholder="New character name"
              aria-label="New character name"
              disabled={atMax}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={atMax}>
              Add character
            </button>
          </form>
          {atMax && <p className={styles.hint}>You&apos;ve reached the limit of {MAX_CHARACTERS} characters.</p>}
        </div>
      )}
    </div>
  );
}
