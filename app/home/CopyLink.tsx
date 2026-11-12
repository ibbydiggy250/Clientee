"use client";

/** Shows an invite link with a button that copies it. */
import { useState } from "react";

import styles from "@/components/paper/paper.module.css";

export function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still visible and selectable.
    }
  }

  return (
    <div className={`${styles.field} ${styles.fadeIn}`}>
      <span className={styles.note}>{label} ↓</span>
      <input className={styles.input} readOnly value={url} onFocus={(event) => event.target.select()} aria-label={label} />
      <button type="button" className={styles.secondary} onClick={copy}>
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
