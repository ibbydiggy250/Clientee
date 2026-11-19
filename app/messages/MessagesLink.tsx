/** "Messages" link for home screens, with the unread count circled in red pen. */
import Link from "next/link";

import styles from "@/components/messages/messages.module.css";
import paper from "@/components/paper/paper.module.css";

export function MessagesLink({ unread }: { unread: number }) {
  return (
    <Link className={`${paper.secondary} ${styles.messagesLink}`} href="/messages">
      Messages
      {unread > 0 && (
        <span className={styles.unreadInline} aria-label={`${unread} unread`}>
          {unread}
        </span>
      )}
    </Link>
  );
}
