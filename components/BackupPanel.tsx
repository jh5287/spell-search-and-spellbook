"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  MAX_BACKUP_BYTES,
  countNewSpells,
  downloadBackup,
  importBackup,
  parseBackup,
  type BackupContents,
  type ImportMode,
} from "@/lib/backup";
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

export default function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
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
    <details className={styles.panel}>
      <summary className={styles.summary}>Backup &amp; restore</summary>
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
      </div>
    </details>
  );
}
