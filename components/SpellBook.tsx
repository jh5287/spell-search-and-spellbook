"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BOOK_VIEWS, bookView, groupSpells, type BookView } from "@/lib/spellbook";
import { useLocalStore } from "@/lib/localStore";
import type { CastOption, Tracker } from "@/lib/slots";
import type { Spell } from "@/lib/spells";
import CastControl from "./CastControl";
import { GripIcon } from "./icons";
import SpellCard from "./SpellCard";
import styles from "./SpellBook.module.css";

interface Props {
  spells: Spell[];
  tracker: Tracker;
  onCast: (spell: Spell, option: CastOption) => void;
  onReorder: (groupKey: string, activeId: string, overId: string) => void;
  onRemove: (index: string) => void;
  onEdit: (spell: Spell) => void;
}

interface ItemProps {
  spell: Spell;
  view: BookView;
  arranging: boolean;
  tracker: Tracker;
  onCast: (spell: Spell, option: CastOption) => void;
  onRemove: (index: string) => void;
  onEdit: (spell: Spell) => void;
}

function SortableSpell({ spell, view, arranging, tracker, onCast, onRemove, onEdit }: ItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: spell.index, disabled: !arranging });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.item} ${isDragging ? styles.dragging : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <SpellCard
        spell={spell}
        variant={view}
        headingLevel={3}
        handle={
          arranging && (
            <button
              ref={setActivatorNodeRef}
              className={styles.handle}
              aria-label={`Reorder ${spell.name}`}
              {...attributes}
              {...listeners}
            >
              <GripIcon />
            </button>
          )
        }
        actions={
          <>
            <CastControl spell={spell} tracker={tracker} onCast={onCast} />
            {spell.custom && (
              <button className="btn" aria-label={`Edit ${spell.name}`} onClick={() => onEdit(spell)}>
                Edit
              </button>
            )}
            <button
              className="btn"
              aria-label={`Remove ${spell.name} from book`}
              onClick={() => {
                if (window.confirm(`Remove ${spell.name} from your spell book?`)) onRemove(spell.index);
              }}
            >
              Remove
            </button>
          </>
        }
      />
    </div>
  );
}

export default function SpellBook({ spells, tracker, onCast, onReorder, onRemove, onEdit }: Props) {
  const [view, setView] = useLocalStore(bookView);
  const [arranging, setArranging] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (spells.length === 0) {
    return <p className={styles.empty}>Your spell book is empty. Search for a spell and add it to see it here.</p>;
  }

  function handleDragEnd(groupKey: string, { active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onReorder(groupKey, String(active.id), String(over.id));
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.segments} role="radiogroup" aria-label="Display style">
          {BOOK_VIEWS.map((o) => (
            <label key={o.value} className={styles.segment}>
              <input
                type="radio"
                name="book-view"
                value={o.value}
                checked={view === o.value}
                onChange={() => setView(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
        <button className="btn" aria-pressed={arranging} onClick={() => setArranging((a) => !a)}>
          {arranging ? "Done arranging" : "Arrange"}
        </button>
      </div>
      {arranging && (
        <p className={styles.hint}>
          Drag a card by its grip handle to reorder it within its section. With the keyboard, focus the
          handle, press Space, use the arrow keys, then Space again to drop.
        </p>
      )}

      {groupSpells(spells).map(({ key, heading, spells: group }) => (
        <section key={key} className={styles.level}>
          <h2 className={styles.levelHeading}>
            {heading} <span className={styles.count}>({group.length})</span>
          </h2>
          <DndContext
            id={`group-${key}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => handleDragEnd(key, e)}
          >
            <SortableContext
              items={group.map((s) => s.index)}
              strategy={view === "list" ? verticalListSortingStrategy : rectSortingStrategy}
            >
              <div className={`${styles.grid} ${styles[view]}`}>
                {group.map((spell) => (
                  <SortableSpell
                    key={spell.index}
                    spell={spell}
                    view={view}
                    arranging={arranging}
                    tracker={tracker}
                    onCast={onCast}
                    onRemove={onRemove}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      ))}
    </div>
  );
}
