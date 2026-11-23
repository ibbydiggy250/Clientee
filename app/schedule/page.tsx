/**
 * Clientee → Schedule: a week calendar with every session pinned to it (and
 * the tutor's open hours shaded in), then the sessions as lists in folder
 * panels: ones to record, upcoming, and past.
 * Sessions waiting on the tutor (ended but not recorded) ping on the calendar.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import type { CalendarSession } from "@/components/calendar/WeekCalendar";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import desk from "@/components/desk/desk.module.css";
import { PortalShell } from "@/components/desk/PortalShell";
import styles from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { getMyHours } from "@/lib/availability";
import { listSessionsInRange, listVisibleSessions } from "@/lib/booking";
import { addDays, calendarWeek, easternMoment } from "@/lib/eastern-time";

import { SessionList } from "../sessions/SessionList";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { user, profile } = await requireProfile();
  if (profile.role === "client") redirect("/sessions");
  if (profile.role === "admin") redirect("/admin");

  const now = new Date();
  const monday = calendarWeek((await searchParams).week, now);
  const [sessions, weekSessions, hours] = await Promise.all([
    listVisibleSessions(user, now),
    listSessionsInRange(user, easternMoment(monday, "00:00"), easternMoment(addDays(monday, 7), "00:00")),
    getMyHours(user),
  ]);

  const calendarSessions: CalendarSession[] = weekSessions.map((session) => ({
    id: session.id,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    status: session.status,
    subject: session.subject,
    who: session.learnerName,
    // Over but not recorded yet: the tutor needs to say how it went.
    needsAction: session.status === "scheduled" && session.endsAt <= now,
  }));

  return (
    <PortalShell user={user} profile={profile}>
      <div className={styles.sheet}>
        <header className={desk.sectionHead}>
          <div className={desk.pageHead}>
            <p className={styles.note}>clientee · all your sessions, Eastern time</p>
            <h1 className={desk.pageTitle}>Schedule.</h1>
          </div>
          <Link className={styles.secondary} href="/profile#hours">Edit weekly hours</Link>
        </header>

        <section className={`${desk.panel} ${desk.panelBlue}`} aria-labelledby="week-heading">
          <h2 id="week-heading" className={desk.panelTab}>calendar</h2>
          <WeekCalendar monday={monday} sessions={calendarSessions} hours={hours} now={now} basePath="/schedule" />
        </section>

        <SessionList items={sessions} viewer="tutor" now={now} />
      </div>
    </PortalShell>
  );
}
