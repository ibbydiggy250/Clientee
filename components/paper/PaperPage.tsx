/**
 * The page frame for every "Margin Notes" screen: ruled paper, the TutorMe
 * mark on the left and an optional action (Sign in, Sign out…) on the right.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { body, display, hand } from "./fonts";
import styles from "./paper.module.css";

export function PaperPage({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${styles.page} ${display.variable} ${hand.variable} ${body.variable}`}>
      <header className={styles.bar}>
        <Link href="/" className={styles.logo}>
          Tutor<em>Me</em>
        </Link>
        {action}
      </header>
      <main>{children}</main>
    </div>
  );
}

/** A hand-drawn red loop around a word; draws itself in on load. */
export function PenCircle() {
  return (
    <svg className={styles.penCircle} viewBox="0 0 220 90" aria-hidden preserveAspectRatio="none">
      <path
        pathLength={1}
        d="M18 52 C 14 18, 120 4, 188 22 C 226 34, 210 76, 120 84 C 52 90, 4 70, 24 38 C 34 24, 70 14, 104 12"
      />
    </svg>
  );
}

/** A red tick in the corner of a picked card. */
export function PenTick() {
  return (
    <svg className={styles.penTick} viewBox="0 0 60 50" aria-hidden>
      <path pathLength={1} d="M6 28 L 22 44 L 54 6" />
    </svg>
  );
}
