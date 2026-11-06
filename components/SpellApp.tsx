"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocalStore } from "@/lib/localStore";
import {
  newCastId,
  recordCast,
  slotLabel,
  slotTracker,
  targetRow,
  undoCast,
  type Cast,
  type CastOption,
} from "@/lib/slots";
import { addToBook, removeFromBook, reorderWithinGroup, replaceInBook, spellBook } from "@/lib/spellbook";
import type { Spell } from "@/lib/spells";
import CustomSpellForm from "./CustomSpellForm";
import BackupPanel from "./BackupPanel";
import { BookIcon, PlusIcon, SearchIcon, SlotsIcon } from "./icons";
import SlotTracker from "./SlotTracker";
import SpellBook from "./SpellBook";
import SpellSearch from "./SpellSearch";
import UseBanner, { type BannerMessage } from "./UseBanner";
import styles from "./SpellApp.module.css";

type Mode = "search" | "create" | "book" | "slots";

const TITLES: Record<Mode, string> = {
  search: "Spell Lookup",
  create: "Create Your Own",
  book: "Spell Book",
  slots: "Spell Slots",
};

export default function SpellApp() {
  const [mode, setMode] = useState<Mode>("search");
  const [saved, setSaved] = useLocalStore(spellBook);
  const [tracker, setTracker] = useLocalStore(slotTracker);
  const savedIds = useMemo(() => new Set(saved.map((s) => s.index)), [saved]);

  // the custom entry currently being edited in the Create tab, if any
  const [editing, setEditing] = useState<Spell | null>(null);
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const dismissBanner = useCallback(() => setBanner(null), []);

  const addSpell = (s: Spell) => setSaved((prev) => addToBook(prev, s));

  /** Spends a slot for the spell, notes which spell it went to, and offers an undo. */
  function castSpell(spell: Spell, option: CastOption) {
    const row = targetRow(tracker, option.target);
    if (!row || row.used >= row.max) return;

    const cast: Cast = { id: newCastId(), name: spell.name, level: spell.level };
    setTracker((prev) => recordCast(prev, option.target, cast));
    setBanner({
      id: cast.id,
      undoable: true,
      text: `Used ${spell.name}: spent a ${slotLabel(option.target, option.level)}${option.level > spell.level ? " (upcast)" : ""}. ${row.max - row.used - 1} left.`,
    });
  }

  function undoBanner() {
    if (!banner) return;
    setTracker((prev) => undoCast(prev, banner.id));
    setBanner({ id: `undo-${banner.id}`, undoable: false, text: "Undone: the spell slot is back." });
  }

  function finishEditing() {
    setEditing(null);
    setMode("book");
  }

  const tabs: { mode: Mode; label: string; icon: ReactNode; badge?: number }[] = [
    { mode: "search", label: "Search", icon: <SearchIcon /> },
    { mode: "create", label: "Create", icon: <PlusIcon /> },
    { mode: "book", label: "Book", icon: <BookIcon />, badge: saved.length },
    { mode: "slots", label: "Slots", icon: <SlotsIcon /> },
  ];

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{mode === "create" && editing ? "Edit Entry" : TITLES[mode]}</h1>
        <nav className={styles.nav} aria-label="Sections">
          {tabs.map((t) => (
            <button
              key={t.mode}
              className={styles.tab}
              aria-current={mode === t.mode ? "page" : undefined}
              aria-label={t.badge ? `${t.label} (${t.badge} saved)` : t.label}
              onClick={() => setMode(t.mode)}
            >
              {t.icon}
              <span>{t.label}</span>
              {!!t.badge && <span className={styles.badge} aria-hidden="true">{t.badge}</span>}
            </button>
          ))}
        </nav>
      </header>

      {/* search and create stay mounted while hidden so typed text and the spell list aren't lost */}
      <div hidden={mode !== "search"}>
        <SpellSearch savedIds={savedIds} onAdd={addSpell} />
      </div>
      <div hidden={mode !== "create" || !!editing}>
        <CustomSpellForm saved={saved} onAdd={addSpell} />
      </div>
      {editing && (
        <div hidden={mode !== "create"}>
          <CustomSpellForm
            key={editing.index}
            saved={saved}
            onAdd={addSpell}
            editing={editing}
            onSave={(updated) => {
              setSaved((prev) => replaceInBook(prev, updated));
              finishEditing();
            }}
            onCancel={finishEditing}
          />
        </div>
      )}
      {mode === "book" && (
        <SpellBook
          spells={saved}
          tracker={tracker}
          onCast={castSpell}
          onReorder={(key, activeId, overId) =>
            setSaved((prev) => reorderWithinGroup(prev, key, activeId, overId))
          }
          onRemove={(index) => setSaved((prev) => removeFromBook(prev, index))}
          onEdit={(spell) => {
            setEditing(spell);
            setMode("create");
          }}
        />
      )}
      {mode === "slots" && <SlotTracker />}
      <BackupPanel />
      <UseBanner banner={banner} onUndo={undoBanner} onDismiss={dismissBanner} />
    </main>
  );
}
