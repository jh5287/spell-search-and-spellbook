import type { Metadata } from "next";
import "./globals.css";

import type { Viewport } from "next";
import AppearanceEffect from "@/components/AppearanceEffect";
import { APPEARANCE_INIT_SCRIPT } from "@/lib/appearance";

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  title: "Spell Book",
  description: "Fast D&D 5e spell lookup",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // the script in <head> sets the saved theme before the first paint, so React must accept what it changed
    <html lang="en" data-theme="light" data-schools="on" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }} />
      </head>
      <body>
        <AppearanceEffect />
        {children}
      </body>
    </html>
  );
}
