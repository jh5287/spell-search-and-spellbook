"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  MAX_BACKUP_BYTES,
  countNewSpells,
  downloadBackup,
  eraseEverything,
  importBackup,
  parseBackup,
  type BackupContents,
  type ImportMode,
} from "@/lib/backup";
import { useAccount } from "./AccountProvider";
import styles from "./BackupPanel.module.css";

interface Pending {
  fileName: string;
  contents: BackupContents;
  exportedAt?: string;
  newSpells: number;
}

interface Message {
  text: string;
  error?: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface PanelProps {
  /** Called after a hard reset so the rest of the app can drop anything it was holding. */
  onReset?: () => void;
}

export default function BackupPanel({ onReset }: PanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmingErase, setConfirmingErase] = useState(false);
  const { user } = useAccount();
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    setPending(null);
    if (!file) return;

    if (file.size > MAX_BACKUP_BYTES) {
      setMessage({ text: "That file is too large to be a Spell Book backup.", error: true });
      return;
    }
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setMessage({ text: result.error, error: true });
      return;
    }
    setMessage(null);
    setPending({
      fileName: file.name,
      contents: result.contents,
      exportedAt: result.exportedAt,
      newSpells: countNewSpells(result.contents),
    });
  }

  // land on the safe choice so a stray Enter or Space can't erase anything
  useEffect(() => {
    if (confirmingErase) cancelRef.current?.focus();
  }, [confirmingErase]);

  function erase() {
    eraseEverything();
    setPending(null);
    setConfirmingErase(false);
    setMessage({ text: "Everything was erased. You're starting with a blank slate." });
    onReset?.();
  }

  function runImport(mode: ImportMode) {
    if (!pending) return;
    if (mode === "replace" && !window.confirm("Replace your spell book and slot tracker with the contents of this file?")) {
      return;
    }
    importBackup(pending.contents, mode);
    const { spells } = pending.contents;
    setMessage({
      text:
        mode === "replace"
          ? `Backup restored${spells ? `: ${plural(spells.length, "spell")} in your book` : ""}.`
          : `Imported ${plural(pending.newSpells, "new spell")}.`,
    });
    setPending(null);
  }

  const { contents, exportedAt } = pending ?? {};
  const exportedOn = exportedAt && !Number.isNaN(Date.parse(exportedAt)) ? new Date(exportedAt).toLocaleDateString() : null;

  return (
    <div className={styles.body}>
      <p className={styles.text}>
        Your spell book and slot tracker are saved in this browser. Export a file to keep a copy, or to move them to
        another browser or device.
      </p>
      <div className={styles.actions}>
        <button className="btn" onClick={downloadBackup}>
          Export backup
        </button>
        <button className="btn" onClick={() => inputRef.current?.click()}>
          Import backup…
        </button>
        <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={handleFile} />
      </div>

      {pending && contents && (
        <div className={styles.preview}>
          <p className={styles.text}>
            <strong>{pending.fileName}</strong>
            {exportedOn && ` (exported ${exportedOn})`} contains{" "}
            {[
              contents.spells && `${plural(contents.spells.length, "spell")} (${pending.newSpells} not in your book yet)`,
              contents.tracker && "a slot tracker",
            ]
              .filter(Boolean)
              .join(" and ")}
            .
          </p>
          <div className={styles.actions}>
            <button className="btn btn-primary" onClick={() => runImport("merge")}>
              Add to my book
            </button>
            <button className="btn" onClick={() => runImport("replace")}>
              Replace what I have
            </button>
            <button className="btn" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
          <p className={styles.hint}>
            Adding keeps your current spells and slot tracker (a tracker is only brought in if you don&apos;t have one).
          </p>
        </div>
      )}

      <p role="status" className={message?.error ? styles.error : styles.status}>
        {message?.text}
      </p>

      <div className={styles.danger}>
        <h3 className={styles.dangerHeading}>Start over</h3>
        <p className={styles.text}>
          Permanently deletes your spell book, custom spells, slot tracker and settings
          {user ? " from this browser and from your account (it saves automatically, so the account copy is erased too)" : " from this browser"}.
          Export a backup first if you might want them back.
        </p>
        {confirmingErase ? (
          <div className={styles.confirm}>
            <p className={styles.text}>
              <strong>Erase everything? This can&apos;t be undone.</strong>
            </p>
            <div className={styles.actions}>
              <button className={`btn ${styles.dangerBtn}`} onClick={erase}>
                Yes, erase everything
              </button>
              <button ref={cancelRef} className="btn" onClick={() => setConfirmingErase(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <button className={`btn ${styles.dangerOutline}`} onClick={() => setConfirmingErase(true)}>
              Erase everything…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
