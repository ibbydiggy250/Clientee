/** Clientee → Schedule: every session, to record, upcoming and past. (Moved from the old tutor home.) */
import Link from "next/link";
import { redirect } from "next/navigation";

import desk from "@/components/desk/desk.module.css";
import { PortalShell } from "@/components/desk/PortalShell";
import styles from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { listVisibleSessions } from "@/lib/booking";

import { SessionList } from "../sessions/SessionList";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const { user, profile } = await requireProfile();
  if (profile.role === "client") redirect("/sessions");
  if (profile.role === "admin") redirect("/admin");

  const now = new Date();
  const sessions = await listVisibleSessions(user, now);

  return (
    <PortalShell user={user} profile={profile}>
      <div className={styles.sheet}>
        <header className={desk.sectionHead}>
          <div className={desk.pageHead}>
            <p className={styles.note}>clientee · all your sessions, Eastern time</p>
            <h1 className={desk.pageTitle}>Schedule.</h1>
          </div>
          <Link className={styles.secondary} href="/availability">Weekly hours</Link>
        </header>
        <SessionList items={sessions} viewer="tutor" now={now} />
      </div>
    </PortalShell>
  );
}
