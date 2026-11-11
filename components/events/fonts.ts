import { EB_Garamond, Libre_Franklin } from "next/font/google";

// The Event Planner's two faces: EB Garamond for display (titles, key
// numbers), Libre Franklin for text and UI. Exposed as CSS variables on the
// planner's `.ep` wrapper only, so no other section of the app picks them up.
export const display = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const text = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-text",
  display: "swap",
});

/** Class names for the planner wrapper: the `ep` scope plus both fonts. */
export const plannerClass = `ep ${display.variable} ${text.variable}`;
