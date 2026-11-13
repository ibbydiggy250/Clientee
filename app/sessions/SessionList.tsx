/**
 * A list of sessions for a home screen, as tear-off calendar dates.
 *
 * Families see: upcoming sessions (move / cancel) and the last week's history.
 * Tutors see: sessions to record (once over), upcoming ones (cancel), history.
 */
import Link from "next/link";

import booking from "@/components/booking/booking.module.css";
import paper from "@/components/paper/paper.module.css";
import { isWithinLateWindow, type SessionListItem } from "@/lib/booking";
import { EASTERN, formatSessionTime } from "@/lib/eastern-time";

import { CancelButton } from "./CancelButton";
import { OutcomeButtons } from "./OutcomeButtons";

type Viewer = "family" | "tutor";

const STATUS_WORDS: Record<SessionListItem["status"], string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

function CalendarPage({ at }: { at: Date }) {
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, ...options }).format(at);
  return (
    <div className={booking.calendarPage} aria-hidden>
      <span className={booking.calendarMonth}>{part({ weekday: "short" })} · {part({ month: "short" })}</span>
      <span className={booking.calendarDay}>{part({ day: "numeric" })}</span>
      <span className={booking.calendarTime}>{part({ hour: "numeric", minute: "2-digit" })}</span>
    </div>
  );
}

function SessionRow({ item, viewer, now }: { item: SessionListItem; viewer: Viewer; now: Date }) {
  const isScheduled = item.status === "scheduled";
  const hasEnded = item.endsAt <= now;
  const isLateNow = isWithinLateWindow(item.startsAt, now);
  const who = viewer === "tutor" ? item.learnerName : `${item.learnerName} with ${item.tutorName}`;

  return (
    <div className={booking.sessionRow}>
      <CalendarPage at={item.startsAt} />
      <div className={paper.field}>
        <span className={`${paper.heading} ${item.status === "cancelled" ? booking.struck : ""}`}>{item.subject}</span>
        <span>{who}</span>
        <span className={booking.small}>
          {formatSessionTime(item.startsAt)} ET · {STATUS_WORDS[item.status]}
          {item.cancelledLate && " (late — charged)"}
        </span>
      </div>
      <div className={booking.sessionActions}>
        {isScheduled && viewer === "tutor" && hasEnded && <OutcomeButtons sessionId={item.id} />}
        {isScheduled && !hasEnded && item.startsAt > now && (
          <>
            {viewer === "family" &&
              (isLateNow ? (
                <span className={booking.small}>Too close to move</span>
              ) : (
                <Link className={paper.secondary} href={`/book/move/${item.id}`}>
                  Move
                </Link>
              ))}
            <CancelButton sessionId={item.id} willBeCharged={viewer === "family" && isLateNow} />
          </>
        )}
      </div>
    </div>
  );
}

export function SessionList({ items, viewer, now }: { items: SessionListItem[]; viewer: Viewer; now: Date }) {
  const toRecord = items.filter((item) => item.status === "scheduled" && item.endsAt <= now);
  const upcoming = items.filter((item) => item.status === "scheduled" && item.endsAt > now);
  const history = items.filter((item) => item.status !== "scheduled").reverse();

  return (
    <div className={paper.fields}>
      {viewer === "tutor" && toRecord.length > 0 && (
        <section className={paper.fields} aria-labelledby="to-record-heading">
          <h3 id="to-record-heading" className={paper.note}>how did these go? ↓</h3>
          {toRecord.map((item) => <SessionRow key={item.id} item={item} viewer={viewer} now={now} />)}
        </section>
      )}

      {upcoming.length === 0 ? (
        <p className={paper.muted}>Nothing booked yet.</p>
      ) : (
        <section aria-label="Upcoming sessions">
          {upcoming.map((item) => <SessionRow key={item.id} item={item} viewer={viewer} now={now} />)}
        </section>
      )}

      {history.length > 0 && (
        <details>
          <summary className={paper.link}>Cancelled &amp; past ({history.length})</summary>
          {history.map((item) => <SessionRow key={item.id} item={item} viewer={viewer} now={now} />)}
        </details>
      )}
    </div>
  );
}
