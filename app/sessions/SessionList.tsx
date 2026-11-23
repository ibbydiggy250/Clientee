/**
 * A list of sessions for a home screen, as tear-off calendar dates.
 *
 * Families see: upcoming sessions (move / cancel) and the last week's history.
 * Tutors see: sessions to record (once over), upcoming ones (cancel), history.
 */
import Link from "next/link";

import booking from "@/components/booking/booking.module.css";
import desk from "@/components/desk/desk.module.css";
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
    // The id lets a note on the week calendar jump to this row.
    <div id={`session-${item.id}`} className={booking.sessionRow}>
      <CalendarPage at={item.startsAt} />
      <div className={paper.field}>
        <span className={`${paper.heading} ${item.status === "cancelled" ? booking.struck : ""}`}>{item.subject}</span>
        <span>{who}</span>
        <span className={booking.small}>
          <span className={booking.when}>{formatSessionTime(item.startsAt)} ET</span> · {STATUS_WORDS[item.status]}
          {item.cancelledLate && " (late — charged)"}
        </span>
        {isScheduled && !hasEnded && !item.zoomJoinUrl && <span className={booking.zoomSoon}>zoom link coming soon</span>}
      </div>
      <div className={booking.sessionActions}>
        {isScheduled && !hasEnded && item.zoomJoinUrl && (
          <a className={`${paper.primary} ${paper.compact}`} href={item.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
            Join ↗
          </a>
        )}
        {isScheduled && viewer === "tutor" && hasEnded && <OutcomeButtons sessionId={item.id} />}
        {isScheduled && !hasEnded && item.startsAt > now && (
          <>
            {viewer === "family" &&
              (isLateNow ? (
                <span className={booking.small}>Too close to move</span>
              ) : (
                <Link className={`${paper.secondary} ${paper.compact}`} href={`/book/move/${item.id}`}>
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

  // Each group is its own folder panel, so the page reads as compartments.
  return (
    <div className={paper.fields}>
      {viewer === "tutor" && toRecord.length > 0 && (
        <section className={`${desk.panel} ${desk.panelPink}`} aria-labelledby="to-record-heading">
          <h2 id="to-record-heading" className={desk.panelTab}>
            needs you <span className={desk.panelCount}>{toRecord.length}</span>
          </h2>
          <p className={desk.panelHint}>How did these go? Recording it pays you and charges the family.</p>
          <div>{toRecord.map((item) => <SessionRow key={item.id} item={item} viewer={viewer} now={now} />)}</div>
        </section>
      )}

      <section className={desk.panel} aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className={desk.panelTab}>
          coming up {upcoming.length > 0 && <span className={desk.panelCount}>{upcoming.length}</span>}
        </h2>
        {upcoming.length === 0 ? (
          <p className={desk.emptyNote}>Nothing booked yet.</p>
        ) : (
          <div>{upcoming.map((item) => <SessionRow key={item.id} item={item} viewer={viewer} now={now} />)}</div>
        )}
      </section>

      {history.length > 0 && (
        <section className={`${desk.panel} ${desk.panelPaper}`} aria-labelledby="history-heading">
          <h2 id="history-heading" className={desk.panelTab}>past &amp; cancelled</h2>
          <details>
            <summary className={paper.link}>Show the last week ({history.length})</summary>
            {history.map((item) => <SessionRow key={item.id} item={item} viewer={viewer} now={now} />)}
          </details>
        </section>
      )}
    </div>
  );
}
