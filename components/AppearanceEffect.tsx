"use client";

import { useLayoutEffect } from "react";
import { DARK_QUERY, applyAppearance } from "@/lib/appearance";
import { appearance } from "@/lib/appearanceStore";

/**
 * Keeps <html> in step with the saved appearance. The inline script in layout.tsx handles the first paint;
 * this covers changes made afterwards, other tabs, the OS switching between light and dark, and React's
 * development remount, which clears attributes the script set.
 */
export default function AppearanceEffect() {
  useLayoutEffect(() => {
    // read the store directly rather than through React state: the hydration pass would see the defaults
    const apply = () => applyAppearance(appearance.getSnapshot());
    apply();
    const unsubscribe = appearance.subscribe(apply);
    const media = window.matchMedia(DARK_QUERY);
    media.addEventListener("change", apply);
    return () => {
      unsubscribe();
      media.removeEventListener("change", apply);
    };
  }, []);

  return null;
}
