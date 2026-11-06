"use client";

import { useEffect, useRef } from "react";
import { downloadBackup } from "@/lib/backup";
import type { Contents } from "@/lib/sync";
import { useAccount } from "./AccountProvider";
import styles from "./SyncConflictDialog.module.css";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function describe(c: Contents): string {
  const parts = [plural(c.spells.length, "spell")];
  if (c.tracker.classes.length || c.tracker.slots.length || c.tracker.abilities.length) parts.push("a slot tracker");
  return parts.join(" and ");
}

/** Shown when this browser and the account both have changes the other hasn't seen. Nothing is lost until a choice is made. */
export default function SyncConflictDialog() {
  const { sync, resolveConflict } = useAccount();
  const conflict = sync.conflict;
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (conflict && !dialog.open) dialog.showModal();
    if (!conflict && dialog.open) dialog.close();
  }, [conflict]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="conflict-title"
      // a choice is needed, so Escape doesn't dismiss it
      onCancel={(e) => e.preventDefault()}
    >
      {conflict && (
        <div className={styles.body}>
          <h2 id="conflict-title" className={styles.title}>
            Two versions of your book
          </h2>
          <p className={styles.text}>
            This browser has <strong>{describe(conflict.local)}</strong>, and your account has{" "}
            <strong>{describe(conflict.cloud)}</strong>. Nothing has been changed yet. How should they be combined?
          </p>
          <div className={styles.choices}>
            <button className="btn btn-primary" autoFocus onClick={() => resolveConflict("merge")}>
              Merge both (recommended)
            </button>
            <p className={styles.hint}>Keeps every spell from both. If your account has a slot tracker, that one is kept.</p>
            <button className="btn" onClick={() => resolveConflict("cloud")}>
              Use my account&apos;s version
            </button>
            <p className={styles.hint}>Replaces what&apos;s in this browser.</p>
            <button className="btn" onClick={() => resolveConflict("device")}>
              Use this browser&apos;s version
            </button>
            <p className={styles.hint}>Replaces what&apos;s in your account.</p>
          </div>
          <button className={styles.link} onClick={downloadBackup}>
            Download this browser&apos;s data first
          </button>
        </div>
      )}
    </dialog>
  );
}
