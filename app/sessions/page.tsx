/** Family desk → Sessions: everything booked, plus the "booked / moved" confirmations. */
import { redirect } from "next/navigation";

import desk from "@/components/desk/desk.module.css";
import { PortalShell } from "@/components/desk/PortalShell";
import styles from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { listVisibleSessions } from "@/lib/booking";

import { SessionList } from "./SessionList";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; skipped?: string; moved?: string }>;
}) {
  const { user, profile } = await requireProfile();
  if (profile.role === "tutor") redirect("/schedule");
  if (profile.role === "admin") redirect("/admin");

  const now = new Date();
  const sessions = await listVisibleSessions(user, now);
  const { booked, skipped, moved } = await searchParams;

  return (
    <PortalShell user={user} profile={profile}>
      <div className={styles.sheet}>
        <header className={desk.pageHead}>
          <p className={styles.note}>60 minutes each · free to cancel or move up to 24h before</p>
          <h1 className={desk.pageTitle}>Sessions.</h1>
        </header>

        {booked && (
          <p className={styles.note}>
            {booked === "1" ? "booked! ✓" : `booked ${booked} weekly sessions ✓`}
            {skipped && skipped !== "0" && ` (${skipped} week${skipped === "1" ? " was" : "s were"} already taken, so skipped)`}
          </p>
        )}
        {moved && <p className={styles.note}>moved ✓</p>}

        <SessionList items={sessions} viewer="family" now={now} />
        <p className={styles.hint}>To book more, open a learner on the Learners tab.</p>
      </div>
    </PortalShell>
  );
}
