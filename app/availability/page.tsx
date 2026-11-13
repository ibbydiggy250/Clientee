/**
 * Clientee: the tutor's weekly hours. Families book 60-minute sessions inside
 * these windows. Shown as a week of day pages with washi-tape strips.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import booking from "@/components/booking/booking.module.css";
import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { getMyHours } from "@/lib/availability";
import { formatClock, formatClockRange, WEEKDAY_NAMES } from "@/lib/eastern-time";

import { SignOutButton } from "../home/SignOutButton";
import { removeHoursAction } from "../sessions/actions";
import { AddHoursForm } from "./AddHoursForm";

export const dynamic = "force-dynamic";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function AvailabilityPage() {
  const { user, profile } = await requireProfile();
  if (profile.role !== "tutor") redirect("/home");

  const hours = await getMyHours(user);

  return (
    <PaperPage action={<SignOutButton />}>
      <div className={paper.sheet}>
        <p className={paper.note}>clientee · when can families book you?</p>
        <h1 className={`${paper.title} ${paper.titleSmall}`}>
          Your weekly{" "}
          <span className={paper.circled}>
            hours.
            <PenCircle />
          </span>
        </h1>
        <p className={paper.muted}>
          Families book 60-minute sessions inside these hours, Eastern time. Removing hours doesn&apos;t cancel sessions
          that are already booked.
        </p>

        <div className={booking.week}>
          {WEEK_ORDER.map((weekday) => {
            const windows = hours.filter((window) => window.weekday === weekday);
            return (
              <section key={weekday} className={booking.day} aria-label={WEEKDAY_NAMES[weekday]}>
                <span className={booking.dayName}>{WEEKDAY_NAMES[weekday].slice(0, 3).toLowerCase()}</span>
                {windows.length === 0 && <span className={booking.empty}>no hours</span>}
                {windows.map((window) => (
                  <form key={window.id} action={removeHoursAction} className={booking.tape}>
                    <input type="hidden" name="windowId" value={window.id} />
                    <span>{formatClockRange(window.startTime, window.endTime)}</span>
                    <button
                      type="submit"
                      className={booking.tapeRemove}
                      aria-label={`Remove ${WEEKDAY_NAMES[weekday]} ${formatClock(window.startTime)} to ${formatClock(window.endTime)}`}
                    >
                      ✕
                    </button>
                  </form>
                ))}
              </section>
            );
          })}
        </div>

        <section className={paper.fields} aria-labelledby="add-hours-heading">
          <h2 id="add-hours-heading" className={paper.heading}>Add hours</h2>
          <AddHoursForm />
        </section>

        <Link className={paper.link} href="/home">
          ← Back to your learners
        </Link>
      </div>
    </PaperPage>
  );
}
