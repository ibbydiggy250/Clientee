/**
 * Messages: the conversation list beside whichever conversation is open,
 * inside the same desk (stamp + tabs) as the rest of each person's area.
 * What's listed depends on who they are.
 */
import type { ReactNode } from "react";

import { PortalShell } from "@/components/desk/PortalShell";
import styles from "@/components/messages/messages.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { listThreads } from "@/lib/messaging";

import { ThreadList } from "./ThreadList";

export const dynamic = "force-dynamic";

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireProfile();
  const threads = await listThreads(user);

  return (
    <PortalShell user={user} profile={profile}>
      <div className={styles.layout}>
        <aside className={styles.listPane}>
          <h1 className={styles.listTitle}>Messages</h1>
          <ThreadList threads={threads} />
        </aside>
        {children}
      </div>
    </PortalShell>
  );
}
