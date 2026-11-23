/** Family desk → Sessions: everything booked, plus the "booked / moved" confirmations. */
import { redirect } from "next/navigation";

import desk from "@/components/desk/desk.module.css";
import { PortalShell } from "@/components/desk/PortalShell";
import styles from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import type { CalendarSession } from "@/components/calendar/WeekCalendar";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { listSessionsInRange, listVisibleSessions } from "@/lib/booking";
import { addDays, calendarWeek, easternMoment } from "@/lib/eastern-time";

import { SessionList } from "./SessionList";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string; skipped?: string; moved?: string; week?: string }>;
}) {
  const { user, profile } = await requireProfile();
  if (profile.role === "tutor") redirect("/schedule");
  if (profile.role === "admin") redirect("/admin");

  const now = new Date();
  const { booked, skipped, moved, week } = await searchParams;
  const monday = calendarWeek(week, now);
  const [sessions, weekSessions] = await Promise.all([
    listVisibleSessions(user, now),
    listSessionsInRange(user, easternMoment(monday, "00:00"), easternMoment(addDays(monday, 7), "00:00")),
  ]);

  const calendarSessions: CalendarSession[] = weekSessions.map((session) => ({
    id: session.id,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    status: session.status,
    subject: session.subject,
    who: `${session.learnerName} · ${session.tutorName}`,
    needsAction: false, // nothing on a session waits on the family yet
  }));

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

        <section className={`${desk.panel} ${desk.panelBlue}`} aria-labelledby="week-heading">
          <h2 id="week-heading" className={desk.panelTab}>calendar</h2>
          <WeekCalendar monday={monday} sessions={calendarSessions} now={now} basePath="/sessions" />
        </section>

        <SessionList items={sessions} viewer="family" now={now} />
        <p className={styles.hint}>To book more, open a learner on the Learners tab.</p>
      </div>
    </PortalShell>
  );
}
