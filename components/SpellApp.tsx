"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
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
import { NO_FILTERS, type BookFilters } from "@/lib/spellFilters";
import { addToBook, removeFromBook, reorderWithinGroup, replaceInBook, spellBook } from "@/lib/spellbook";
import type { Spell } from "@/lib/spells";
import CustomSpellForm from "./CustomSpellForm";
import AccountMenu from "./AccountMenu";
import { BookIcon, MenuIcon, PlusIcon, SearchIcon, SlotsIcon } from "./icons";
import SettingsMenu from "./SettingsMenu";
import SlotTracker from "./SlotTracker";
import SpellBook from "./SpellBook";
import SpellSearch from "./SpellSearch";
import SyncConflictDialog from "./SyncConflictDialog";
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
  // kept here, not in the book, so filters survive a trip to another tab; they reset on reload
  const [filters, setFilters] = useState<BookFilters>(NO_FILTERS);
  const dismissBanner = useCallback(() => setBanner(null), []);

  // On a narrow screen the tabs collapse into a menu behind the hamburger button.
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!navRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
        <button
          ref={menuButtonRef}
          className={styles.menuButton}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls={navId}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MenuIcon open={menuOpen} />
        </button>
        <h1 className={styles.title}>{mode === "create" && editing ? "Edit Entry" : TITLES[mode]}</h1>
        <nav id={navId} ref={navRef} className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`} aria-label="Sections">
          {tabs.map((t) => (
            <button
              key={t.mode}
              className={styles.tab}
              aria-current={mode === t.mode ? "page" : undefined}
              aria-label={t.badge ? `${t.label} (${t.badge} saved)` : t.label}
              onClick={() => {
                setMode(t.mode);
                setMenuOpen(false);
              }}
            >
              {t.icon}
              <span>{t.label}</span>
              {!!t.badge && <span className={styles.badge} aria-hidden="true">{t.badge}</span>}
            </button>
          ))}
        </nav>
        <div className={styles.tools}>
          <SettingsMenu
            onReset={() => {
              setEditing(null);
              setBanner(null);
              setFilters(NO_FILTERS);
              setMode("search");
            }}
          />
          <AccountMenu />
        </div>
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
          filters={filters}
          onFiltersChange={setFilters}
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
      <SyncConflictDialog />
      <UseBanner banner={banner} onUndo={undoBanner} onDismiss={dismissBanner} />
    </main>
  );
}
