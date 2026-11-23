/**
 * Admin: messages held by the contact filter (mvp-spec.md, "Quality"), and a
 * way into every conversation. Each held message is its own card in the
 * "held for review" panel (Nov 19, 2026 clean-up).
 */
import Link from "next/link";

import paper from "@/components/paper/paper.module.css";
import { EASTERN } from "@/lib/eastern-time";
import { listHeldMessages } from "@/lib/messaging";

import styles from "../admin.module.css";
import { getAdminActor } from "../guard";
import { ReviewButtons } from "./ReviewButtons";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export default async function AdminMessagesPage() {
  const admin = await getAdminActor();
  if (!admin) return null; // the layout already shows "staff only"

  const held = await listHeldMessages(admin);

  return (
    <div className={paper.sheet}>
      <p className={paper.note}>keeping it all inside TutorMe</p>
      <h1 className={`${paper.title} ${paper.titleSmall}`}>Messages.</h1>

      <section className={`${styles.panel} ${styles.panelPink}`} aria-labelledby="held-heading">
        <h2 id="held-heading" className={styles.panelTab}>
          held for review {held.length > 0 && <span className={styles.panelCount}>{held.length}</span>}
        </h2>
        <p className={styles.panelHint}>Messages with phone numbers, emails, handles or links wait here until you decide.</p>
        {held.length === 0 ? (
          <p className={styles.emptyNote}>Nothing waiting.</p>
        ) : (
          <div className={`${styles.cards} ${styles.cardsWide}`}>
            {held.map((message) => (
              <article key={message.id} className={`${styles.card} ${styles.cardUrgent}`}>
                <div className={styles.cardTop}>
                  <span className={styles.name}>{message.senderName}</span>
                  <span className={styles.small}>{when(message.createdAt)} ET</span>
                </div>
                <span className={styles.small}>
                  {message.senderRole} · <Link className={paper.link} href={`/messages/${message.threadId}`}>{message.threadTitle}</Link>
                </span>
                <p className={styles.quote}>“{message.body}”</p>
                {message.flagReason && <span className={styles.margin}>looks like a {message.flagReason}</span>}
                <ReviewButtons messageId={message.id} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={`${styles.panel} ${styles.panelBlue}`} aria-labelledby="all-heading">
        <h2 id="all-heading" className={styles.panelTab}>every conversation</h2>
        <p className={styles.panelHint}>Read any thread: learners and tutors, families and TutorMe, tutors and TutorMe.</p>
        <Link className={paper.secondary} href="/messages">Open all conversations →</Link>
      </section>
    </div>
  );
}
