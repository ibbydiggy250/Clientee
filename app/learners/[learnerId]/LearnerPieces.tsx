/**
 * Pieces both learner-page views share:
 *   - LearnerHeader: the name written big, with grade and subjects as stamps
 *   - NumberTiles: a row of big numbers with handwritten labels
 *   - SessionTimeline: sessions as a dotted timeline, newest first
 *   - ProgressSketch: a pencil sketch of a chart with a "coming soon" stamp,
 *     holding the place for progress tracking (arrives with session notes, v1)
 */
import Link from "next/link";
import type { ReactNode } from "react";

import desk from "@/components/desk/desk.module.css";
import paper from "@/components/paper/paper.module.css";
import type { SessionListItem } from "@/lib/booking";
import { formatSessionTime } from "@/lib/eastern-time";

import styles from "./learner.module.css";

export function LearnerHeader({ note, name, details, tags }: { note: string; name: string; details: string; tags: string[] }) {
  return (
    <header className={styles.header}>
      <Link href="/learners" className={styles.back}>
        ← all learners
      </Link>
      <p className={paper.note}>{note}</p>
      <h1 className={styles.name}>
        {name}
        <svg className={styles.underline} viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden>
          <path pathLength={1} d="M4 14 C 60 4, 140 18, 200 9 S 280 6, 296 12" />
        </svg>
      </h1>
      <div className={styles.tags}>
        {details && <span className={paper.muted}>{details}</span>}
        {tags.map((tag) => (
          <span key={tag} className={`${paper.stamp} ${paper.stampDone}`}>{tag}</span>
        ))}
      </div>
    </header>
  );
}

export function NumberTiles({ tiles }: { tiles: { label: string; value: ReactNode }[] }) {
  return (
    <div className={desk.stats}>
      {tiles.map((tile) => (
        <div key={tile.label} className={desk.stat}>
          <span className={desk.statNumber}>{tile.value}</span>
          <span className={desk.statLabel}>{tile.label}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_WORDS: Record<SessionListItem["status"], string> = {
  scheduled: "booked",
  completed: "done",
  cancelled: "cancelled",
  no_show: "no-show",
};

/** Sessions on a dotted line; `who` says who each one was with, from this viewer's side. */
export function SessionTimeline({ items, who, empty, now }: { items: SessionListItem[]; who: (item: SessionListItem) => string; empty: string; now: Date }) {
  if (items.length === 0) return <p className={desk.emptyNote}>{empty}</p>;
  return (
    <ol className={styles.timeline}>
      {items.map((item) => (
        <li key={item.id} className={`${styles.timelineItem} ${styles[`dot_${item.status}`]}`}>
          <span className={styles.timelineWhen}>{formatSessionTime(item.startsAt)} ET</span>
          <span className={styles.timelineTitle}>
            {item.subject} <span className={paper.muted}>· {who(item)}</span>
          </span>
          <span className={styles.timelineStatus}>
            {item.status === "scheduled" && item.endsAt <= now ? "not recorded yet" : STATUS_WORDS[item.status]}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ProgressSketch({ caption }: { caption: string }) {
  return (
    <div className={styles.sketch}>
      <svg className={styles.sketchChart} viewBox="0 0 320 140" aria-hidden>
        <path className={styles.sketchAxis} d="M20 10 L20 120 L310 120" />
        <path className={styles.sketchLine} pathLength={1} d="M24 104 C 60 98, 80 90, 110 84 S 160 70, 190 62 S 250 40, 300 26" />
        {[110, 190, 300].map((x, index) => (
          <circle key={x} className={styles.sketchDot} cx={x} cy={[84, 62, 26][index]} r="4" />
        ))}
      </svg>
      <span className={styles.sketchStamp}>coming soon</span>
      <p className={paper.hint}>{caption}</p>
    </div>
  );
}
