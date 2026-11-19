/** "Next up": the next booked session as a big ticket, for Home and Today. */
import Link from "next/link";

import type { SessionListItem } from "@/lib/booking";
import { EASTERN } from "@/lib/eastern-time";

import styles from "./desk.module.css";

type Props = {
  session: SessionListItem;
  /** Who the session is with, from this viewer's side. */
  withWhom: string;
  href: string;
  linkLabel: string;
};

export function NextSessionTicket({ session, withWhom, href, linkLabel }: Props) {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, ...options }).format(session.startsAt);

  return (
    <article className={styles.ticket} aria-label="Your next session">
      <div className={styles.ticketDate} aria-hidden>
        <span className={styles.ticketMonth}>{part({ weekday: "short" })} · {part({ month: "short" })}</span>
        <span className={styles.ticketDay}>{part({ day: "numeric" })}</span>
      </div>
      <div>
        <span className={styles.ticketLabel}>next up</span>
        <h2 className={styles.ticketTitle}>{session.subject}</h2>
        <span className={styles.ticketMeta}>
          <span className={styles.nowrap}>{part({ weekday: "long", month: "long", day: "numeric" })}</span> ·{" "}
          <span className={styles.nowrap}>{part({ hour: "numeric", minute: "2-digit" })} ET</span> · {withWhom}
        </span>
      </div>
      <div className={styles.ticketSide}>
        {/* Zoom: a Join button once the meeting exists, a quiet note until then */}
        {session.zoomJoinUrl ? (
          <a className={styles.ticketJoin} href={session.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
            Join on Zoom ↗
          </a>
        ) : (
          <span className={styles.ticketZoomSoon}>zoom link coming soon</span>
        )}
        <Link className={styles.ticketLink} href={href}>{linkLabel}</Link>
      </div>
    </article>
  );
}
