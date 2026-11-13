"use client";

/**
 * Pick a time: open 60-minute slots laid out as day pages, grouped by week.
 * Picking one slides up a confirm bar. Used for booking and for moving a session.
 */
import { useActionState, useState } from "react";

import booking from "@/components/booking/booking.module.css";
import paper from "@/components/paper/paper.module.css";
import { formatClock } from "@/lib/eastern-time";

import { bookAction, rescheduleAction, type SessionFormState } from "../sessions/actions";

/** A slot as sent from the server: the moment travels as an ISO string. */
export type PlannerSlot = { date: string; clock: string; startsAt: string };

type Props =
  | { mode: "book"; enrollmentId: string; slots: PlannerSlot[]; priceLabel: string }
  | { mode: "move"; sessionId: string; slots: PlannerSlot[]; priceLabel?: undefined };

/** "Thu" and "Nov 20" for an ISO date (dates are already Eastern calendar dates). */
function dayLabels(isoDate: string) {
  const noon = new Date(`${isoDate}T12:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(noon);
  return { weekday: format({ weekday: "short" }), date: format({ month: "short", day: "numeric" }), long: format({ weekday: "long", month: "long", day: "numeric" }) };
}

/** Splits dates into weeks of seven, starting from the first date shown. */
function groupByWeek(slots: PlannerSlot[]): { label: string; days: [string, PlannerSlot[]][] }[] {
  const byDay = new Map<string, PlannerSlot[]>();
  for (const slot of slots) byDay.set(slot.date, [...(byDay.get(slot.date) ?? []), slot]);

  const days = [...byDay.entries()];
  if (days.length === 0) return [];
  const firstDay = new Date(`${days[0][0]}T12:00:00Z`).getTime();
  const labels = ["Next few days", "The week after", "In two weeks"];

  const weeks: { label: string; days: [string, PlannerSlot[]][] }[] = [];
  for (const day of days) {
    const weekIndex = Math.floor((new Date(`${day[0]}T12:00:00Z`).getTime() - firstDay) / (7 * 86_400_000));
    weeks[weekIndex] ??= { label: labels[weekIndex] ?? "Later", days: [] };
    weeks[weekIndex].days.push(day);
  }
  return weeks.filter(Boolean);
}

export function SlotPlanner(props: Props) {
  const action = props.mode === "book" ? bookAction : rescheduleAction;
  const [state, formAction, isSaving] = useActionState<SessionFormState, FormData>(action, {});
  const [picked, setPicked] = useState<PlannerSlot | null>(null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);

  const weeks = groupByWeek(props.slots);

  if (weeks.length === 0) {
    return <p className={paper.muted}>No open times in the next three weeks. Check back soon, or message TutorMe.</p>;
  }

  return (
    <div className={paper.fields}>
      {weeks.map((week) => (
        <section key={week.label} className={paper.fields} aria-label={week.label}>
          <h2 className={paper.note}>{week.label}</h2>
          <div className={booking.plannerWeek}>
            {week.days.map(([date, daySlots]) => {
              const labels = dayLabels(date);
              return (
                <div key={date} className={booking.day}>
                  <span className={booking.dayName}>{labels.weekday.toLowerCase()}</span>
                  <span className={booking.dayDate}>{labels.date}</span>
                  <div className={booking.tickets}>
                    {daySlots.map((slot) => (
                      <button
                        key={slot.startsAt}
                        type="button"
                        className={booking.ticket}
                        aria-pressed={picked?.startsAt === slot.startsAt}
                        aria-label={`${labels.long} at ${formatClock(slot.clock)}`}
                        onClick={() => setPicked(slot)}
                      >
                        {formatClock(slot.clock)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {picked && (
        <form action={formAction} className={booking.confirm}>
          {props.mode === "book" ? (
            <input type="hidden" name="enrollmentId" value={props.enrollmentId} />
          ) : (
            <input type="hidden" name="sessionId" value={props.sessionId} />
          )}
          <input type="hidden" name="startsAt" value={picked.startsAt} />

          <span className={booking.confirmTitle}>
            {dayLabels(picked.date).long} at {formatClock(picked.clock)} ET
          </span>

          {props.mode === "book" && (
            <>
              <label className={paper.consent}>
                <input
                  type="checkbox"
                  name="repeatWeekly"
                  value="yes"
                  checked={repeatWeekly}
                  onChange={(event) => setRepeatWeekly(event.target.checked)}
                />
                <span>Repeat every week at this time (up to 12 weeks, while the tutor&apos;s contract runs)</span>
              </label>
              <span className={booking.small}>
                60 minutes · {props.priceLabel}
                {repeatWeekly ? " per session" : ""} · free to cancel or move up to 24 hours before
              </span>
            </>
          )}

          {state.error && <p role="alert" className={paper.error}>{state.error}</p>}
          <div className={paper.row}>
            <button type="submit" className={paper.primary} disabled={isSaving}>
              {isSaving ? "Saving…" : props.mode === "book" ? (repeatWeekly ? "Book weekly" : "Book this time") : "Move it here"}
            </button>
            <button type="button" className={paper.link} onClick={() => setPicked(null)}>
              Pick another time
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
