/**
 * The three typefaces of the "Margin Notes" look:
 *   display — Fraunces, a soft editorial serif for headings
 *   hand    — Caveat, the tutor's handwriting for little notes
 *   body    — Inter Tight, a clean sans for everything else
 */
import { Caveat, Fraunces, Inter_Tight } from "next/font/google";

export const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-display",
});

export const hand = Caveat({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-hand",
});

export const body = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-body",
});
