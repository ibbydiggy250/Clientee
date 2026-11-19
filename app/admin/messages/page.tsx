/**
 * Admin: messages held by the contact filter (mvp-spec.md, "Quality"), and a
 * way into every conversation.
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

      <div className={paper.row}>
        <Link className={paper.secondary} href="/messages">Open every conversation →</Link>
      </div>

      <section className={paper.fields} aria-labelledby="held-heading">
        <h2 id="held-heading" className={paper.heading}>Held for review</h2>
        {held.length === 0 ? (
          <p className={paper.muted}>Nothing waiting. Messages with phone numbers, emails, handles or links land here.</p>
        ) : (
          <div className={styles.ledger} style={{ "--columns": "1fr 1.6fr 1fr" } as React.CSSProperties}>
            <div className={styles.ledgerHead}>
              <span>From · conversation</span>
              <span>Message</span>
              <span>Decision</span>
            </div>
            {held.map((message) => (
              <div key={message.id} className={styles.ledgerRow}>
                <div className={paper.field}>
                  <span className={styles.name}>{message.senderName}</span>
                  <span className={styles.small}>
                    {message.senderRole} · <Link className={paper.link} href={`/messages/${message.threadId}`}>{message.threadTitle}</Link>
                  </span>
                  <span className={styles.small}>{when(message.createdAt)} ET</span>
                </div>
                <div className={paper.field}>
                  <span>“{message.body}”</span>
                  {message.flagReason && <span className={styles.margin}>looks like a {message.flagReason}</span>}
                </div>
                <ReviewButtons messageId={message.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
