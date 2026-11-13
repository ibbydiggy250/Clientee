/**
 * Booking, cancelling and finishing sessions (mvp-spec.md, "Scheduling and
 * sessions"), with the rules the user chose on Nov 13, 2026:
 *
 *   - Sessions are 60 minutes, priced at the enrollment's hourly rate.
 *   - Families may cancel or reschedule for free up to 24 hours before.
 *     A later family cancellation is "late" and charged in full.
 *     A tutor or admin cancelling is never late.
 *   - A tutor match is enough to book (the card-on-file rule comes with Stripe).
 *
 * Writes run as the database owner, so every function checks permissions
 * itself. Every function takes `now`, so the rules can be tested at any time.
 * The database also refuses double-booking on its own (migration 0007).
 */
import { randomUUID } from "node:crypto";

import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";

import { availability, enrollments, learners, profiles, sessions, tutors } from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import { orm, withUser } from "@/lib/db";
import { hasPostgresCode } from "@/lib/db-errors";
import { addDays, easternClock, easternDate, easternMoment, weekdayOf } from "@/lib/eastern-time";

export const SESSION_MINUTES = 60;
/** How far ahead a booking must be. */
export const MIN_NOTICE_HOURS = 12;
/** Cancelling or rescheduling closer than this is "late". */
export const LATE_CANCEL_HOURS = 24;
/** How many days the booking planner shows. */
export const PLANNER_DAYS = 21;
/** How many weeks a "repeat weekly" booking covers at most. */
export const SERIES_WEEKS = 12;

const HOUR = 60 * 60 * 1000;

/** A problem the person can fix; its message is safe to show. */
export class BookingError extends Error {}

// ---------------------------------------------------------------------------
// Finding open slots (pure: no database, so it's easy to test)
// ---------------------------------------------------------------------------

export type WeeklyWindow = { weekday: number; startTime: string; endTime: string };
export type BusyTime = { startsAt: Date; endsAt: Date };
export type Slot = { date: string; clock: string; startsAt: Date; endsAt: Date };

function minutesOf(clockTime: string): number {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return hours * 60 + minutes;
}

function clockOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Every 60-minute slot inside the tutor's weekly windows, from `fromDate` for
 * `days` days, that is far enough ahead, on or before the contract's end, and
 * not overlapping something already booked.
 */
export function findOpenSlots(input: {
  windows: WeeklyWindow[];
  busy: BusyTime[];
  fromDate: string;
  days: number;
  now: Date;
  termEnd: string | null;
}): Slot[] {
  const earliestStart = input.now.getTime() + MIN_NOTICE_HOURS * HOUR;
  const slots: Slot[] = [];

  for (let offset = 0; offset < input.days; offset++) {
    const date = addDays(input.fromDate, offset);
    if (input.termEnd && date > input.termEnd) break;

    const windowsToday = input.windows
      .filter((window) => window.weekday === weekdayOf(date))
      .sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime));

    for (const window of windowsToday) {
      const windowEnd = minutesOf(window.endTime);
      for (let start = minutesOf(window.startTime); start + SESSION_MINUTES <= windowEnd; start += SESSION_MINUTES) {
        const startsAt = easternMoment(date, clockOf(start));
        const endsAt = new Date(startsAt.getTime() + SESSION_MINUTES * 60_000);

        const tooSoon = startsAt.getTime() < earliestStart;
        const clashes = input.busy.some((busy) => busy.startsAt < endsAt && busy.endsAt > startsAt);
        if (!tooSoon && !clashes) slots.push({ date, clock: clockOf(start), startsAt, endsAt });
      }
    }
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Loading what booking needs
// ---------------------------------------------------------------------------

type BookingContext = {
  enrollment: typeof enrollments.$inferSelect;
  learnerName: string;
  tutorId: string;
  tutorName: string;
  tutorStatus: (typeof tutors.$inferSelect)["status"];
  termEnd: string | null;
  windows: WeeklyWindow[];
};

async function loadBookingContext(enrollmentId: string): Promise<BookingContext> {
  const [row] = await orm
    .select({ enrollment: enrollments, learnerName: learners.name, tutor: tutors, tutorName: profiles.name })
    .from(enrollments)
    .innerJoin(learners, eq(learners.id, enrollments.learnerId))
    .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
    .innerJoin(profiles, eq(profiles.id, tutors.profileId))
    .where(eq(enrollments.id, enrollmentId));
  if (!row) throw new BookingError("That tutoring match no longer exists.");

  const windows = await orm
    .select({ weekday: availability.weekday, startTime: availability.startTime, endTime: availability.endTime })
    .from(availability)
    .where(eq(availability.tutorId, row.tutor.id));

  return {
    enrollment: row.enrollment,
    learnerName: row.learnerName,
    tutorId: row.tutor.id,
    tutorName: row.tutorName,
    tutorStatus: row.tutor.status,
    termEnd: row.tutor.termEnd,
    windows,
  };
}

/** The tutor's scheduled sessions between two moments (optionally ignoring one). */
async function loadBusyTimes(tutorId: string, from: Date, to: Date, ignoreSessionId?: string): Promise<BusyTime[]> {
  return orm
    .select({ startsAt: sessions.startsAt, endsAt: sessions.endsAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.taughtBy, tutorId),
        eq(sessions.status, "scheduled"),
        lt(sessions.startsAt, to),
        gt(sessions.endsAt, from),
        ignoreSessionId ? ne(sessions.id, ignoreSessionId) : undefined,
      ),
    );
}

/** True if the user is this learner's account holder, or the learner. Asked of the database's own rule. */
async function isFamilyOf(user: SignedInUser, learnerId: string): Promise<boolean> {
  return withUser(user.id, async (tx) => {
    const result = await tx.execute(sql`select app.is_family_of(${learnerId}::uuid) as ok`);
    return Boolean((result.rows[0] as { ok?: boolean } | undefined)?.ok);
  });
}

async function isAdmin(user: SignedInUser): Promise<boolean> {
  const [profile] = await orm.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, user.id));
  return profile?.role === "admin";
}

/** Why new sessions can't be booked on this match right now, or null if they can. */
function whyBookingIsClosed(context: BookingContext, now: Date): string | null {
  if (context.enrollment.status !== "active") return "This tutoring match isn't active any more.";
  if (context.tutorStatus !== "active") return `${context.tutorName} isn't taking new bookings.`;
  if (context.termEnd && context.termEnd < easternDate(now)) return `${context.tutorName}'s contract has ended.`;
  if (context.windows.length === 0) return `${context.tutorName} hasn't set their weekly hours yet.`;
  return null;
}

async function openSlotsFor(context: BookingContext, fromDate: string, days: number, now: Date, ignoreSessionId?: string) {
  const from = easternMoment(fromDate, "00:00");
  const to = easternMoment(addDays(fromDate, days), "00:00");
  const busy = await loadBusyTimes(context.tutorId, from, to, ignoreSessionId);
  return findOpenSlots({ windows: context.windows, busy, fromDate, days, now, termEnd: context.termEnd });
}

// ---------------------------------------------------------------------------
// The booking page
// ---------------------------------------------------------------------------

export type BookingPage = {
  learnerName: string;
  tutorName: string;
  subject: string;
  rateCents: number;
  closedReason: string | null;
  slots: Slot[];
};

export async function getBookingPage(user: SignedInUser, enrollmentId: string, now: Date): Promise<BookingPage> {
  const context = await loadBookingContext(enrollmentId);
  if (!(await isFamilyOf(user, context.enrollment.learnerId))) {
    throw new BookingError("Only the learner or their account holder can book these sessions.");
  }

  const closedReason = whyBookingIsClosed(context, now);
  const slots = closedReason ? [] : await openSlotsFor(context, easternDate(now), PLANNER_DAYS, now);

  return {
    learnerName: context.learnerName,
    tutorName: context.tutorName,
    subject: context.enrollment.subject,
    rateCents: context.enrollment.rateCents,
    closedReason,
    slots,
  };
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

export type BookingResult = { bookedDates: string[]; skippedDates: string[] };

/**
 * Books one session, or the same time every week for up to SERIES_WEEKS
 * weeks (stopping at the contract's end). Weeks that are taken or outside the
 * tutor's hours are skipped and reported, never forced.
 */
export async function bookSessions(
  user: SignedInUser,
  input: { enrollmentId: string; startsAt: Date; repeatWeekly: boolean },
  now: Date,
): Promise<BookingResult> {
  const context = await loadBookingContext(input.enrollmentId);
  if (!(await isFamilyOf(user, context.enrollment.learnerId))) {
    throw new BookingError("Only the learner or their account holder can book these sessions.");
  }
  const closedReason = whyBookingIsClosed(context, now);
  if (closedReason) throw new BookingError(closedReason);

  // Work in Eastern date + clock time, so weekly repeats survive daylight saving.
  const firstDate = easternDate(input.startsAt);
  const clock = easternClock(input.startsAt);
  const weeks = input.repeatWeekly ? SERIES_WEEKS : 1;

  const bookedSlots: Slot[] = [];
  const skippedDates: string[] = [];
  for (let week = 0; week < weeks; week++) {
    const date = addDays(firstDate, week * 7);
    if (context.termEnd && date > context.termEnd) break;
    const slot = (await openSlotsFor(context, date, 1, now)).find((open) => open.clock === clock);
    if (slot) bookedSlots.push(slot);
    else if (week === 0) throw new BookingError("That time isn't open any more. Pick another one.");
    else skippedDates.push(date);
  }

  const seriesId = bookedSlots.length > 1 ? randomUUID() : null;
  try {
    await orm.insert(sessions).values(
      bookedSlots.map((slot) => ({
        enrollmentId: context.enrollment.id,
        taughtBy: context.tutorId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        priceCents: Math.round((context.enrollment.rateCents * SESSION_MINUTES) / 60),
        bookedBy: user.id,
        seriesId,
      })),
    );
  } catch (problem) {
    // Someone else booked one of these times a moment ago.
    if (hasPostgresCode(problem, "23P01")) throw new BookingError("That time was just taken. Pick another one.");
    throw problem;
  }

  return { bookedDates: bookedSlots.map((slot) => slot.date), skippedDates };
}

// ---------------------------------------------------------------------------
// Cancelling and rescheduling
// ---------------------------------------------------------------------------

async function loadSession(sessionId: string) {
  const [row] = await orm
    .select({ session: sessions, learnerId: enrollments.learnerId, tutorProfileId: tutors.profileId })
    .from(sessions)
    .innerJoin(enrollments, eq(enrollments.id, sessions.enrollmentId))
    .innerJoin(tutors, eq(tutors.id, sessions.taughtBy))
    .where(eq(sessions.id, sessionId));
  if (!row) throw new BookingError("That session no longer exists.");
  return row;
}

export function isWithinLateWindow(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() - now.getTime() < LATE_CANCEL_HOURS * HOUR;
}

/**
 * Cancels a scheduled session. Returns whether it counted as late (charged).
 * Only a family cancelling inside 24 hours is late.
 */
export async function cancelSession(user: SignedInUser, sessionId: string, now: Date): Promise<{ late: boolean }> {
  const { session, learnerId, tutorProfileId } = await loadSession(sessionId);

  const isFamily = await isFamilyOf(user, learnerId);
  const isTeachingTutor = tutorProfileId === user.id;
  if (!isFamily && !isTeachingTutor && !(await isAdmin(user))) {
    throw new BookingError("You can't cancel this session.");
  }
  if (session.status !== "scheduled") throw new BookingError("This session isn't scheduled any more.");
  if (session.startsAt <= now) throw new BookingError("This session has already started.");

  const late = isFamily && !isTeachingTutor && isWithinLateWindow(session.startsAt, now);

  const updated = await orm
    .update(sessions)
    .set({ status: "cancelled", cancelledAt: now, cancelledBy: user.id, cancelledLate: late })
    .where(and(eq(sessions.id, sessionId), eq(sessions.status, "scheduled")))
    .returning({ id: sessions.id });
  if (updated.length === 0) throw new BookingError("This session isn't scheduled any more.");

  return { late };
}

/**
 * Moves a session to another open slot. Allowed only 24+ hours before the
 * original time; inside that window the family has to cancel instead (late).
 */
export async function rescheduleSession(user: SignedInUser, sessionId: string, newStartsAt: Date, now: Date): Promise<void> {
  const { session, learnerId } = await loadSession(sessionId);
  const isFamily = await isFamilyOf(user, learnerId);
  if (!isFamily && !(await isAdmin(user))) throw new BookingError("You can't move this session.");
  if (session.status !== "scheduled") throw new BookingError("This session isn't scheduled any more.");
  if (isFamily && isWithinLateWindow(session.startsAt, now)) {
    throw new BookingError(`Sessions can only be moved ${LATE_CANCEL_HOURS}+ hours ahead. You can still cancel (it will be charged).`);
  }

  const context = await loadBookingContext(session.enrollmentId);
  const closedReason = whyBookingIsClosed(context, now);
  if (closedReason) throw new BookingError(closedReason);

  const slot = (await openSlotsFor(context, easternDate(newStartsAt), 1, now, sessionId)).find(
    (open) => open.startsAt.getTime() === newStartsAt.getTime(),
  );
  if (!slot) throw new BookingError("That new time isn't open. Pick another one.");

  try {
    const updated = await orm
      .update(sessions)
      .set({ startsAt: slot.startsAt, endsAt: slot.endsAt })
      .where(and(eq(sessions.id, sessionId), eq(sessions.status, "scheduled")))
      .returning({ id: sessions.id });
    if (updated.length === 0) throw new BookingError("This session isn't scheduled any more.");
  } catch (problem) {
    if (hasPostgresCode(problem, "23P01")) throw new BookingError("That time was just taken. Pick another one.");
    throw problem;
  }
}

/** Open slots for moving a session (same tutor, ignoring the session itself). */
export async function getRescheduleSlots(user: SignedInUser, sessionId: string, now: Date): Promise<Slot[]> {
  const { session, learnerId } = await loadSession(sessionId);
  if (!(await isFamilyOf(user, learnerId)) && !(await isAdmin(user))) throw new BookingError("You can't move this session.");
  const context = await loadBookingContext(session.enrollmentId);
  if (whyBookingIsClosed(context, now)) return [];
  return openSlotsFor(context, easternDate(now), PLANNER_DAYS, now, sessionId);
}

// ---------------------------------------------------------------------------
// After the session: completed or no-show
// ---------------------------------------------------------------------------

/**
 * The teaching tutor (or admin) records what happened, once the session is
 * over. "Completed" will trigger the charge when Stripe is added; "no_show"
 * is charged too, per the cancellation policy.
 */
export async function recordOutcome(
  user: SignedInUser,
  sessionId: string,
  outcome: "completed" | "no_show",
  now: Date,
): Promise<void> {
  const { session, tutorProfileId } = await loadSession(sessionId);
  if (tutorProfileId !== user.id && !(await isAdmin(user))) {
    throw new BookingError("Only the session's tutor can record how it went.");
  }
  if (session.endsAt > now) throw new BookingError("You can record this once the session is over.");

  const updated = await orm
    .update(sessions)
    .set({ status: outcome })
    .where(and(eq(sessions.id, sessionId), eq(sessions.status, "scheduled")))
    .returning({ id: sessions.id });
  if (updated.length === 0) throw new BookingError("This session was already recorded or cancelled.");
}

// ---------------------------------------------------------------------------
// Lists for the home screens (read through row-level security)
// ---------------------------------------------------------------------------

export type SessionListItem = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: (typeof sessions.$inferSelect)["status"];
  cancelledLate: boolean;
  subject: string;
  learnerName: string;
  tutorName: string;
  enrollmentId: string;
};

/**
 * Sessions this user may see (family: their learners'; tutor: their own),
 * from a little before `now` onwards. Row-level security does the filtering.
 */
export async function listVisibleSessions(user: SignedInUser, now: Date): Promise<SessionListItem[]> {
  const since = new Date(now.getTime() - 7 * 24 * HOUR);
  const rows = await withUser(user.id, (tx) =>
    tx
      .select({
        id: sessions.id,
        startsAt: sessions.startsAt,
        endsAt: sessions.endsAt,
        status: sessions.status,
        cancelledLate: sessions.cancelledLate,
        subject: enrollments.subject,
        learnerName: learners.name,
        enrollmentId: sessions.enrollmentId,
        taughtBy: sessions.taughtBy,
      })
      .from(sessions)
      .innerJoin(enrollments, eq(enrollments.id, sessions.enrollmentId))
      .innerJoin(learners, eq(learners.id, enrollments.learnerId))
      .where(gt(sessions.endsAt, since))
      .orderBy(sessions.startsAt),
  );

  // Tutor names: families may see their tutors' names (row-level security),
  // but looking them up here keeps the query above simple.
  const tutorIds = [...new Set(rows.map((row) => row.taughtBy))];
  const names = tutorIds.length
    ? await orm
        .select({ id: tutors.id, name: profiles.name })
        .from(tutors)
        .innerJoin(profiles, eq(profiles.id, tutors.profileId))
        .where(inArray(tutors.id, tutorIds))
    : [];

  return rows.map(({ taughtBy, ...row }) => ({
    ...row,
    tutorName: names.find((name) => name.id === taughtBy)?.name ?? "Your tutor",
  }));
}
