/** Plain values and functions only, so the root layout (a Server Component) can import it. The saved copy is in appearanceStore.ts. */
export type ThemeMode = "system" | "light" | "dark";

export interface Appearance {
  theme: ThemeMode;
  /** The pop of colour: borders, active tabs, primary buttons. #rrggbb. */
  accent: string;
  /** Text that stays readable on top of `accent`. Stored so the inline script in layout.tsx doesn't have to work it out. */
  onAccent: string;
  /** Tints spell cards by their school of magic. */
  schoolColours: boolean;
}

export const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DARK_TEXT = "#1b1710";

/** White or near-black, whichever has more contrast against `hex`. */
export function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const darkLuminance = 0.009; // of DARK_TEXT
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);
  return whiteContrast >= darkContrast ? "#ffffff" : DARK_TEXT;
}

/** Mid-tones, so each works as a border or fill on both the light and the dark theme. */
export const ACCENT_PRESETS = [
  { name: "Gold", value: "#8a6d3b" },
  { name: "Crimson", value: "#b03a48" },
  { name: "Orange", value: "#c2661d" },
  { name: "Emerald", value: "#2a7d4f" },
  { name: "Teal", value: "#1f8a8a" },
  { name: "Azure", value: "#2f74c0" },
  { name: "Violet", value: "#7b57c4" },
  { name: "Rose", value: "#c2477f" },
];

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "system",
  accent: ACCENT_PRESETS[0].value,
  onAccent: readableOn(ACCENT_PRESETS[0].value),
  schoolColours: true,
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isAppearance(v: unknown): v is Appearance {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Partial<Appearance>;
  return (
    THEME_MODES.some((m) => m.value === a.theme) &&
    typeof a.accent === "string" &&
    HEX.test(a.accent) &&
    typeof a.onAccent === "string" &&
    HEX.test(a.onAccent) &&
    typeof a.schoolColours === "boolean"
  );
}

/** Kept on this device only: a phone and a desktop can reasonably want different themes. */
export const KEY = "spellbook:appearance";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Puts the settings on <html>, where the stylesheets pick them up. */
export function applyAppearance(a: Appearance, root: HTMLElement = document.documentElement) {
  const dark = a.theme === "dark" || (a.theme === "system" && window.matchMedia(DARK_QUERY).matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.schools = a.schoolColours ? "on" : "off";
  root.style.setProperty("--accent", a.accent);
  root.style.setProperty("--on-accent", a.onAccent);
}

/**
 * Runs in <head> before the first paint so a saved theme doesn't flash the default one. It repeats
 * applyAppearance in plain ES5 and must stay in step with it.
 */
export const APPEARANCE_INIT_SCRIPT = `(function(){try{var d=document.documentElement,a=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"null")||{},h=/^#[0-9a-f]{6}$/i,t=a.theme;d.dataset.theme=t==="dark"||(t!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches)?"dark":"light";if(h.test(a.accent)&&h.test(a.onAccent)){d.style.setProperty("--accent",a.accent);d.style.setProperty("--on-accent",a.onAccent)}if(a.schoolColours===false)d.dataset.schools="off"}catch(e){}})()`;
