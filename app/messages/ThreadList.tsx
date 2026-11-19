"use client";

/** The stack of conversation cards; the open one is marked. */
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "@/components/messages/messages.module.css";
import type { ThreadSummary } from "@/lib/messaging";

export function ThreadList({ threads }: { threads: ThreadSummary[] }) {
  const pathname = usePathname();

  if (threads.length === 0) {
    return <p className={styles.threadSubtitle}>No conversations yet. They appear once you&apos;re matched.</p>;
  }

  return (
    <nav aria-label="Conversations" className={styles.listPane}>
      {threads.map((thread) => {
        const href = `/messages/${thread.id}`;
        return (
          <Link key={thread.id} href={href} className={styles.threadCard} aria-current={pathname === href ? "page" : undefined}>
            <span className={styles.threadTitle}>{thread.title}</span>
            <span className={styles.threadSubtitle}>{thread.subtitle}</span>
            <span className={styles.threadPreview}>{thread.lastMessage ?? "No messages yet"}</span>
            {thread.unread > 0 && (
              <span className={styles.unread} aria-label={`${thread.unread} unread`}>
                {thread.unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
