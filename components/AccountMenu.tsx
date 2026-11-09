"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { SyncState } from "@/lib/sync";
import { useAccount } from "./AccountProvider";
import ConnectionCheck from "./ConnectionCheck";
import styles from "./AccountMenu.module.css";

/** Short wording for the header chip, in the spirit of a document that saves itself. */
function statusText(sync: SyncState): { label: string; short: string; tone: "ok" | "busy" | "warn" } {
  switch (sync.status) {
    case "saved":
      return { label: "All changes saved", short: "Saved", tone: "ok" };
    case "saving":
      return { label: "Saving…", short: "Saving…", tone: "busy" };
    case "loading":
      return { label: "Syncing…", short: "Syncing…", tone: "busy" };
    case "offline":
      return { label: "Offline. Will save when you're back", short: "Offline", tone: "warn" };
    case "conflict":
      return { label: "Needs your attention", short: "Attention", tone: "warn" };
    case "error":
      return { label: "Couldn't save", short: "Not saved", tone: "warn" };
    default:
      return { label: "", short: "", tone: "busy" };
  }
}

type Mode = "signin" | "signup";

export default function AccountMenu() {
  const { configured, ready, user, sync, signIn, signUp, signOut } = useAccount();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // close on a click elsewhere, and on Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!configured || !ready) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "signin") {
      const message = await signIn(email.trim(), password);
      if (message) setError(message);
      else close();
    } else {
      const { error: message, needsConfirmation } = await signUp(email.trim(), password);
      if (message) setError(message);
      else if (needsConfirmation) setNotice("Check your email to confirm your account, then sign in.");
      else close();
    }
    setBusy(false);
  }

  function close() {
    setOpen(false);
    setPassword("");
    setError(null);
    setNotice(null);
  }

  const status = statusText(sync);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {user ? (
        <button
          className={styles.chip}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`${styles.dot} ${styles[status.tone]}`} aria-hidden="true" />
          <span className={styles.long}>{status.label || "Account"}</span>
          <span className={styles.short}>{status.short || "Account"}</span>
        </button>
      ) : (
        <button className="btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          Sign in
        </button>
      )}
      {/* the chip's text changes constantly; this is what gets announced */}
      <span role="status" className={styles.srOnly}>
        {user ? status.label : ""}
      </span>

      {open && (
        <div id={panelId} className={styles.panel}>
          {user ? (
            <div className={styles.stack}>
              <p className={styles.small}>Signed in as</p>
              <p className={styles.email}>{user.email}</p>
              <p className={styles.small}>
                {sync.message ??
                  "Your book, slots and settings save to your account automatically, and follow you to any device you sign in on."}
              </p>
              <button
                className="btn"
                onClick={async () => {
                  close();
                  await signOut();
                }}
              >
                Sign out
              </button>
              <ConnectionCheck />
            </div>
          ) : (
            <form className={styles.stack} onSubmit={submit}>
              <h2 className={styles.heading}>{mode === "signin" ? "Sign in" : "Create an account"}</h2>
              <p className={styles.small}>
                Optional. An account saves your book automatically and lets you pick up on any device. Anything already
                in this browser is added to it.
              </p>
              <label className={styles.field}>
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className={styles.notice}>
                  {notice}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setNotice(null);
                }}
              >
                {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
              </button>
              <ConnectionCheck />
            </form>
          )}
        </div>
      )}
    </div>
  );
}
