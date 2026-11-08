"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ACCENT_PRESETS, THEME_MODES, readableOn, type ThemeMode } from "@/lib/appearance";
import { appearance } from "@/lib/appearanceStore";
import { useLocalStore } from "@/lib/localStore";
import { SCHOOLS } from "@/lib/schools";
import BackupPanel from "./BackupPanel";
import { SettingsIcon } from "./icons";
import styles from "./SettingsMenu.module.css";

interface Props {
  /** Called after a hard reset so the rest of the app can drop anything it was holding. */
  onReset?: () => void;
}

export default function SettingsMenu({ onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useLocalStore(appearance);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const nameId = useId();

  // close on a click elsewhere, and on Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setTheme = (theme: ThemeMode) => setSettings((prev) => ({ ...prev, theme }));
  const setAccent = (accent: string) => setSettings((prev) => ({ ...prev, accent, onAccent: readableOn(accent) }));
  const isPreset = ACCENT_PRESETS.some((p) => p.value === settings.accent.toLowerCase());

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        className={`btn ${styles.trigger}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <SettingsIcon />
        <span>Settings</span>
      </button>

      {open && (
        <div id={panelId} role="group" aria-labelledby={nameId} className={styles.panel}>
          <h2 id={nameId} className={styles.heading}>
            Settings
          </h2>

          <section className={styles.section} aria-labelledby={`${nameId}-look`}>
            <h3 id={`${nameId}-look`} className={styles.subheading}>
              Appearance
            </h3>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Theme</legend>
              <div className={styles.segments}>
                {THEME_MODES.map((m) => (
                  <label key={m.value} className={styles.segment}>
                    <input
                      type="radio"
                      name="theme"
                      checked={settings.theme === m.value}
                      onChange={() => setTheme(m.value)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
              <p className={styles.hint}>System follows your device&apos;s light or dark setting.</p>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Accent colour</legend>
              <div className={styles.swatches}>
                {ACCENT_PRESETS.map((p) => (
                  <label key={p.value} className={styles.swatch} title={p.name}>
                    <input
                      type="radio"
                      name="accent"
                      checked={settings.accent.toLowerCase() === p.value}
                      onChange={() => setAccent(p.value)}
                    />
                    <span className={styles.chip} style={{ background: p.value }} />
                    <span className={styles.srOnly}>{p.name}</span>
                  </label>
                ))}
                <label className={`${styles.custom} ${isPreset ? "" : styles.customActive}`}>
                  Custom
                  <input type="color" value={settings.accent} onChange={(e) => setAccent(e.target.value)} />
                </label>
              </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Schools of magic</legend>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={settings.schoolColours}
                  onChange={(e) => setSettings((prev) => ({ ...prev, schoolColours: e.target.checked }))}
                />
                Colour spells by school
              </label>
              {settings.schoolColours && (
                <ul className={styles.legendList}>
                  {SCHOOLS.map((s) => (
                    <li key={s}>
                      <span
                        className={styles.dot}
                        style={{ background: `var(--school-${s.toLowerCase()})` }}
                        aria-hidden="true"
                      />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </section>

          <section className={styles.section} aria-labelledby={`${nameId}-data`}>
            <h3 id={`${nameId}-data`} className={styles.subheading}>
              Backup &amp; data
            </h3>
            <BackupPanel onReset={onReset} />
          </section>
        </div>
      )}
    </div>
  );
}
