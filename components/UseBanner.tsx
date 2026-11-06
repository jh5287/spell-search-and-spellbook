"use client";

import { useEffect, useState, type FocusEvent } from "react";
import styles from "./UseBanner.module.css";

const VISIBLE_MS = 7000;

export interface BannerMessage {
  id: string;
  text: string;
  /** Shows an Undo button. */
  undoable: boolean;
}

interface Props {
  banner: BannerMessage | null;
  onUndo: () => void;
  onDismiss: () => void;
}

/** The timer starts fresh for each message and holds while the pointer or keyboard focus is on it. */
function Toast({ banner, onUndo, onDismiss }: Props & { banner: BannerMessage }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [paused, onDismiss]);

  return (
    <div
      className={styles.toast}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      <span className={styles.text}>{banner.text}</span>
      {banner.undoable && (
        <button className={styles.undo} onClick={onUndo}>
          Undo
        </button>
      )}
      <button className={styles.close} aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}

export default function UseBanner({ banner, onUndo, onDismiss }: Props) {
  return (
    // the live region stays mounted so screen readers announce each new message
    <div className={styles.region} role="status" aria-live="polite">
      {banner && <Toast key={banner.id} banner={banner} onUndo={onUndo} onDismiss={onDismiss} />}
    </div>
  );
}
