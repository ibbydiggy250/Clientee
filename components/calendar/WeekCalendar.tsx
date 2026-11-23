/**
 * One week of sessions as a notebook calendar (tutor Schedule, family Sessions).
 *
 * Days run left to right (Monday first), hours top to bottom, Eastern time.
 * Each session is a note pinned to its day. Sessions that need the viewer to
 * do something (e.g. a tutor recording how it went) get a pulsing red ping.
 * Optionally the tutor's weekly hours are shaded in behind the sessions.
 * Clicking a note jumps to that session's row in the list below the calendar.
 *
 * A server component: week-to-week navigation is plain links (?week=…).
 */
import Link from "next/link";

import { addDays, easternClock, easternDate, formatClockRange, mondayOf } from "@/lib/eastern-time";

import styles from "./calendar.module.css";
import type { WeeklyHours } from "./HoursCalendar";

export type CalendarSession = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  subject: string;
  /** Who the session is with, as this viewer should see it. */
  who: string;
  needsAction: boolean;
};

/** With nothing on the calendar, show the after-school hours most sessions use. */
const DEFAULT_FIRST_HOUR = 14;
const DEFAULT_LAST_HOUR = 21;
const MIN_VISIBLE_HOURS = 6;

function minutesOf(clockTime: string): number {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "Nov 16 – 22", or "Nov 30 – Dec 6" across months. */
function weekLabel(monday: string): string {
  const format = (isoDate: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(new Date(`${isoDate}T12:00:00Z`));
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return `${format(monday, { month: "short", day: "numeric" })} – ${format(sunday, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
}

export function WeekCalendar({
  monday,
  sessions,
  hours = [],
  now,
  basePath,
}: {
  /** The week to show, as its Monday ("YYYY-MM-DD"). */
  monday: string;
  sessions: CalendarSession[];
  hours?: WeeklyHours[];
  now: Date;
  /** The page's own path, for the previous / next week links. */
  basePath: string;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const today = easternDate(now);
  const thisMonday = mondayOf(today);

  // Show only the hours that matter this week (plus an hour either side),
  // so the calendar isn't mostly empty morning.
  const startMinutes = [
    ...sessions.map((session) => minutesOf(easternClock(session.startsAt))),
    ...hours.map((window) => minutesOf(window.startTime)),
  ];
  const endMinutes = [
    ...sessions.map((session) => minutesOf(easternClock(session.endsAt)) || 24 * 60),
    ...hours.map((window) => minutesOf(window.endTime)),
  ];
  let firstHour = startMinutes.length ? Math.max(0, Math.floor(Math.min(...startMinutes) / 60) - 1) : DEFAULT_FIRST_HOUR;
  let lastHour = endMinutes.length ? Math.min(24, Math.ceil(Math.max(...endMinutes) / 60) + 1) : DEFAULT_LAST_HOUR;
  // Keep at least a few hours visible so a quiet week still looks like a calendar.
  while (lastHour - firstHour < MIN_VISIBLE_HOURS) {
    if (lastHour < 24) lastHour++;
    else firstHour--;
  }
  const hourLabels = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const totalMinutes = (lastHour - firstHour) * 60;

  /** Where a block sits in its day column, as CSS percentages. */
  const place = (startClock: string, endClock: string) => {
    const top = ((minutesOf(startClock) - firstHour * 60) / totalMinutes) * 100;
    const end = ((Math.max(minutesOf(endClock) || 24 * 60, minutesOf(startClock) + 30) - firstHour * 60) / totalMinutes) * 100;
    return { top: `${top}%`, height: `${end - top}%` };
  };

  const nowMinutes = minutesOf(easternClock(now));
  const showNowLine = days.includes(today) && nowMinutes >= firstHour * 60 && nowMinutes <= lastHour * 60;

  return (
    <div className={styles.week}>
      <div className={styles.weekNav}>
        <Link className={styles.navButton} href={`${basePath}?week=${addDays(monday, -7)}`} aria-label="Previous week" scroll={false}>
          ←
        </Link>
        <span className={styles.weekLabel}>{weekLabel(monday)}</span>
        <Link className={styles.navButton} href={`${basePath}?week=${addDays(monday, 7)}`} aria-label="Next week" scroll={false}>
          →
        </Link>
        {monday !== thisMonday && (
          <Link className={styles.todayLink} href={basePath} scroll={false}>
            back to this week
          </Link>
        )}
      </div>

      <div className={styles.scroller}>
        <div className={styles.weekGrid} style={{ "--hours": lastHour - firstHour } as React.CSSProperties}>
          {/* Column headers: the day names, today circled */}
          <span aria-hidden />
          {days.map((day) => {
            const date = new Date(`${day}T12:00:00Z`);
            return (
              <span key={day} className={`${styles.weekDayHead} ${day === today ? styles.isToday : ""}`}>
                <span className={styles.weekDayName}>{new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(date).toLowerCase()}</span>
                <span className={styles.weekDayNumber}>{date.getUTCDate()}</span>
              </span>
            );
          })}

          {/* The hour labels down the left */}
          <div className={styles.hourColumn} aria-hidden>
            {hourLabels.map((hour) => (
              <span key={hour} className={styles.hourLabel}>
                {hour % 12 === 0 ? 12 : hour % 12}
                {hour < 12 ? "am" : "pm"}
              </span>
            ))}
          </div>

          {days.map((day) => {
            const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
            const daySessions = sessions.filter((session) => easternDate(session.startsAt) === day);
            return (
              <div key={day} className={`${styles.dayColumn} ${day === today ? styles.todayColumn : ""}`} aria-label={day}>
                {/* The tutor's open hours, shaded in like a highlighter */}
                {hours
                  .filter((window) => window.weekday === weekday)
                  .map((window) => (
                    <span
                      key={`${window.weekday}-${window.startTime}`}
                      className={styles.openHours}
                      style={place(window.startTime, window.endTime)}
                      title={`Open ${formatClockRange(window.startTime, window.endTime)}`}
                    />
                  ))}

                {day === today && showNowLine && (
                  <span className={styles.nowLine} style={{ top: `${((nowMinutes - firstHour * 60) / totalMinutes) * 100}%` }} aria-hidden />
                )}

                {daySessions.map((session, index) => (
                  <a
                    key={session.id}
                    href={`#session-${session.id}`}
                    className={`${styles.pinned} ${styles[`pinned_${session.status}`]} ${session.needsAction ? styles.needsAction : ""}`}
                    style={{ ...place(easternClock(session.startsAt), easternClock(session.endsAt)), rotate: index % 2 ? "1deg" : "-1deg" }}
                    aria-label={`${session.subject} with ${session.who}, ${formatClockRange(easternClock(session.startsAt), easternClock(session.endsAt))}${session.needsAction ? ", needs you" : ""}`}
                  >
                    {session.needsAction ? <span className={styles.ping} aria-hidden /> : <span className={styles.pin} aria-hidden />}
                    <span className={styles.pinnedTitle}>{session.subject}</span>
                    <span className={styles.pinnedMeta}>{session.who}</span>
                    <span className={styles.pinnedMeta}>{formatClockRange(easternClock(session.startsAt), easternClock(session.endsAt))}</span>
                  </a>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.legend} aria-hidden>
        <span><span className={`${styles.legendSwatch} ${styles.legendSession}`} /> session</span>
        {sessions.some((session) => session.needsAction) && (
          <span><span className={`${styles.legendSwatch} ${styles.legendAction}`} /> needs you</span>
        )}
        {hours.length > 0 && <span><span className={`${styles.legendSwatch} ${styles.legendHours}`} /> your open hours</span>}
      </div>
    </div>
  );
}
