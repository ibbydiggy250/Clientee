/**
 * The loading animation: a small pencil writes "Loading…" in the tutor's
 * handwriting, flips over, rubs it out with its eraser, and starts again.
 *
 * It's pure CSS (see loader.module.css): the word is revealed with a clip,
 * and the pencil rides along the clip's edge. Screen readers just hear
 * "Loading".
 */
import styles from "./loader.module.css";

export function PencilLoader() {
  return (
    <div className={styles.loader} role="status" aria-live="polite">
      <span className={styles.word} aria-hidden>
        <span className={styles.ink}>Loading…</span>
        {/* Rides the edge of the writing; inset 0 makes it as wide as the word */}
        <span className={styles.track}>
          <svg className={styles.pencil} viewBox="0 0 64 64" aria-hidden>
            {/* Drawn tip-down at the bottom-left corner, so a half-turn puts the eraser there */}
            <g transform="rotate(45 32 32)">
              <rect x="26" y="4" width="12" height="9" rx="2.5" fill="#e98a8a" />
              <rect x="26" y="12" width="12" height="5" fill="#b9b2a4" />
              <rect x="26" y="17" width="12" height="30" fill="#f2c14e" />
              <rect x="31" y="17" width="2" height="30" fill="#e0a92f" />
              <path d="M26 47 L38 47 L32 60 Z" fill="#f3d9b1" />
              <path d="M30.2 56 L33.8 56 L32 60 Z" fill="#1b2340" />
            </g>
          </svg>
        </span>
      </span>
      <span className={styles.srOnly}>Loading</span>
    </div>
  );
}
