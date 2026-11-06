"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { fetchSpell, fetchSpellList, levelText, suggestSpells, type Spell, type SpellSummary } from "@/lib/spells";
import SpellCard from "./SpellCard";
import styles from "./SpellSearch.module.css";

/** Suggestions listed at first, and the most a "Show more" reveals. */
const FIRST_PAGE = 8;
const MAX_SHOWN = 24;

interface Props {
  savedIds: ReadonlySet<string>;
  onAdd: (spell: Spell) => void;
}

export default function SpellSearch({ savedIds, onAdd }: Props) {
  const [spells, setSpells] = useState<SpellSummary[]>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [limit, setLimit] = useState(FIRST_PAGE);
  // full spells by url, so moving back to one you've already seen is instant
  const [loaded, setLoaded] = useState<Record<string, Spell>>({});
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const requested = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchSpellList(controller.signal)
      .then(setSpells)
      .catch((e) => {
        if (e.name !== "AbortError") setListError(e.message);
      });
    return () => controller.abort();
  }, []);

  const matches = useMemo(() => suggestSpells(query, spells), [query, spells]);
  const visible = matches.slice(0, limit);
  const index = Math.min(activeIndex, visible.length - 1);
  const active: SpellSummary | undefined = visible[index];
  const activeUrl = active?.url;
  const spell = activeUrl ? loaded[activeUrl] : undefined;

  // The best match shows up on its own; arrowing or clicking switches to another. Responses are keyed
  // by url, so a slow reply for a spell you've moved past is harmless.
  useEffect(() => {
    if (!activeUrl || requested.current.has(activeUrl)) return;
    requested.current.add(activeUrl);
    fetchSpell(activeUrl)
      .then((s) => setLoaded((prev) => ({ ...prev, [activeUrl]: s })))
      .catch(() => {
        requested.current.delete(activeUrl);
        setFailedUrl(activeUrl);
      });
  }, [activeUrl, attempt]);

  useEffect(() => {
    document.getElementById(`${listId}-option-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [listId, index]);

  const noMatch = query.trim() && spells.length > 0 && matches.length === 0;
  const canShowMore = limit < MAX_SHOWN && matches.length > limit;

  function handleAdd(s: Spell) {
    onAdd(s);
    setAdded(s.name);
    // keep the text selected so the next keystroke starts a new lookup
    inputRef.current?.select();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (visible.length === 0 || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    setActiveIndex(e.key === "ArrowDown" ? Math.min(visible.length - 1, index + 1) : Math.max(0, index - 1));
  }

  return (
    <section className={styles.container}>
      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        placeholder="Start typing a spell name…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setLimit(FIRST_PAGE);
          setAdded(null);
        }}
        onKeyDown={handleKeyDown}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        role="combobox"
        aria-expanded={visible.length > 0}
        aria-controls={listId}
        aria-activedescendant={active ? optionId(index) : undefined}
        aria-autocomplete="list"
        aria-label="Spell name"
      />
      <p role="status" className={styles.status}>{added && `Added ${added} to your book.`}</p>
      {listError && <p role="alert" className={styles.message}>{listError}</p>}
      {noMatch && <p className={styles.message}>No spell found.</p>}

      {visible.length > 0 && (
        <div className={styles.suggestions}>
          <p className={styles.count}>
            {matches.length === 1 ? "1 possible match" : `${matches.length} possible matches`}. Use the arrow keys or tap one
            to see it.
          </p>
          <ul id={listId} role="listbox" aria-label="Matching spells" className={styles.list}>
            {visible.map((s, i) => (
              <li
                key={s.index}
                id={optionId(i)}
                role="option"
                aria-selected={i === index}
                className={`${styles.option} ${i === index ? styles.selected : ""}`}
                onMouseDown={(e) => e.preventDefault()} // keep the typing focus in the input
                onClick={() => setActiveIndex(i)}
              >
                <span className={styles.optionName}>{s.name}</span>
                <span className={styles.optionMeta}>
                  {levelText(s.level)}
                  {savedIds.has(s.index) && " · ✓ In book"}
                </span>
              </li>
            ))}
          </ul>
          {canShowMore && (
            <button className="btn" onClick={() => setLimit(MAX_SHOWN)}>
              Show more matches ({Math.min(MAX_SHOWN, matches.length) - visible.length} more)
            </button>
          )}
          {!canShowMore && matches.length > visible.length && (
            <p className={styles.count}>Showing the best {visible.length}. Type more of the name to narrow it down.</p>
          )}
        </div>
      )}

      {failedUrl && failedUrl === activeUrl && !spell && (
        <p role="alert" className={styles.message}>
          Could not load that spell.{" "}
          <button
            className="btn"
            onClick={() => {
              requested.current.delete(failedUrl);
              setFailedUrl(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </p>
      )}
      {spell && (
        <SpellCard
          spell={spell}
          actions={
            savedIds.has(spell.index) ? (
              <button className="btn" disabled>✓ In your book</button>
            ) : (
              <button className="btn btn-primary" onClick={() => handleAdd(spell)}>Add to book</button>
            )
          }
        />
      )}
    </section>
  );
}
