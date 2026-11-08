"use client";

import { useState } from "react";
import { diagnoseCloud, formatChecks, type Check, type CheckResult } from "@/lib/diagnose";
import styles from "./ConnectionCheck.module.css";

const MARKS: Record<CheckResult, string> = { pass: "✓", fail: "✗", warn: "!", skip: "–" };

/** Runs through each step a save depends on and says which one is failing, and what to do about it. */
export default function ConnectionCheck() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run() {
    setRunning(true);
    setCopied(false);
    try {
      setChecks(await diagnoseCloud());
    } catch (e) {
      setChecks([{ label: "Connection check", result: "fail", detail: e instanceof Error ? e.message : "Something went wrong." }]);
    }
    setRunning(false);
  }

  async function copy() {
    if (!checks) return;
    try {
      await navigator.clipboard.writeText(formatChecks(checks));
      setCopied(true);
    } catch {
      // clipboard blocked: the results are still on screen to copy by hand
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.link} onClick={run} disabled={running}>
        {running ? "Testing…" : "Test connection"}
      </button>
      <div aria-live="polite">
        {checks && (
          <>
            <ul className={styles.list}>
              {checks.map((c) => (
                <li key={c.label} className={`${styles.item} ${styles[c.result]}`}>
                  <span className={styles.mark} aria-hidden="true">
                    {MARKS[c.result]}
                  </span>
                  <div>
                    <p className={styles.label}>
                      <span className={styles.srOnly}>{c.result}: </span>
                      {c.label}
                    </p>
                    <p className={styles.detail}>{c.detail}</p>
                    {c.fix && c.result !== "pass" && <p className={styles.fix}>{c.fix}</p>}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className={styles.link} onClick={copy}>
              {copied ? "Copied" : "Copy results"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
