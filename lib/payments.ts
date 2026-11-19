/**
 * Money for sessions (mvp-spec.md, "Payments and payouts"): each charged
 * session becomes a `payments` row, split between the teaching tutor
 * (their `split_pct`, 75% by default) and TutorMe. Tutors are paid weekly.
 *
 * NOT CONNECTED TO STRIPE YET. Today this file only RECORDS what is owed:
 *   - Completed sessions, no-shows and late cancellations get a `pending`
 *     payment (cancellation policy decided Nov 13, 2026).
 *   - The admin Money tab adds those up per tutor per week.
 *   - Nobody is charged and nobody is paid.
 *
 * When Stripe is added (STRIPE_SECRET_KEY in .env.local):
 *   1. Fill in `collectPayment` to charge the family's saved card and mark the
 *      payment succeeded or failed (or let a Stripe webhook do that).
 *   2. Add a weekly job that sends each tutor's `getWeeklyPayouts` total as a
 *      Stripe transfer and saves a `payouts` row with the transfer id.
 *   3. Add the card-on-file check to booking.
 * Still undecided in the spec: per-session vs prepaid packages, and whether
 * Stripe's card fee comes out before or after the split. For now the split is
 * taken from the full price and TutorMe absorbs the card fee, as in the spec's
 * $60 → $45 / $15 example.
 */
import { desc, eq, gte, inArray } from "drizzle-orm";

import { enrollments, learners, payments, payouts, profiles, sessions, tutors } from "@/db/schema";
import { orm } from "@/lib/db";
import { addDays, easternDate, easternMoment, weekdayOf } from "@/lib/eastern-time";

/** True once a Stripe key is present. Nothing uses Stripe yet either way. */
export function isStripeConnected(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// ---------------------------------------------------------------------------
// The rules (no database)
// ---------------------------------------------------------------------------

/** Splits a session price: the tutor's share, and TutorMe's platform fee. */
export function splitSessionPrice(priceCents: number, tutorSplitPct: number): { tutorCents: number; platformFeeCents: number } {
  const tutorCents = Math.round((priceCents * tutorSplitPct) / 100);
  return { tutorCents, platformFeeCents: priceCents - tutorCents };
}

/** Is this session charged? Completed, no-show, or cancelled late. */
export function isChargeable(session: { status: string; cancelledLate: boolean }): boolean {
  if (session.status === "completed" || session.status === "no_show") return true;
  return session.status === "cancelled" && session.cancelledLate;
}

/** The Monday (Eastern) of the week a session falls in: its payout week. */
export function payoutWeekOf(at: Date): string {
  const date = easternDate(at);
  const daysSinceMonday = (weekdayOf(date) + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

/** "$45.00" */
export function formatDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Recording a charge (called by booking when a session's outcome is known)
// ---------------------------------------------------------------------------

/**
 * Records the payment for a session that's charged. Safe to call more than
 * once: a session only ever gets one payment. Sessions that aren't charged
 * (scheduled, or cancelled in time) are ignored.
 */
export async function recordSessionCharge(sessionId: string): Promise<void> {
  const [session] = await orm
    .select({ priceCents: sessions.priceCents, status: sessions.status, cancelledLate: sessions.cancelledLate, splitPct: tutors.splitPct })
    .from(sessions)
    .innerJoin(tutors, eq(tutors.id, sessions.taughtBy))
    .where(eq(sessions.id, sessionId));
  if (!session || !isChargeable(session)) return;

  const { platformFeeCents } = splitSessionPrice(session.priceCents, Number(session.splitPct));
  const [payment] = await orm
    .insert(payments)
    .values({ sessionId, amountCents: session.priceCents, feeCents: platformFeeCents, status: "pending" })
    .onConflictDoNothing({ target: payments.sessionId })
    .returning({ id: payments.id });

  if (payment) await collectPayment(payment.id);
}

/**
 * STRIPE GOES HERE: charge the family's saved card for this payment.
 * Until then the payment simply stays `pending`.
 */
async function collectPayment(paymentId: string): Promise<void> {
  if (!isStripeConnected()) return;
  console.warn(`Stripe key found, but charging isn't built yet. Payment ${paymentId} stays pending.`);
}

// ---------------------------------------------------------------------------
// The admin Money tab
// ---------------------------------------------------------------------------

export type PaymentLine = {
  id: string;
  sessionId: string;
  status: (typeof payments.$inferSelect)["status"];
  amountCents: number;
  tutorCents: number;
  platformFeeCents: number;
  sessionStartsAt: Date;
  sessionStatus: (typeof sessions.$inferSelect)["status"];
  subject: string;
  learnerName: string;
  tutorId: string;
  tutorName: string;
};

export type TutorWeek = {
  tutorId: string;
  tutorName: string;
  sessions: number;
  owedCents: number;
  /** Set once a payout has been sent for this tutor and week. */
  paidOut: boolean;
};

export type PayoutWeek = { periodStart: string; tutors: TutorWeek[]; totalCents: number };

const WEEKS_SHOWN = 8;

/** Payments from the last few weeks, newest first. Admin only (uses `orm`). */
export async function listRecentPayments(now: Date): Promise<PaymentLine[]> {
  const since = easternMoment(addDays(payoutWeekOf(now), -7 * (WEEKS_SHOWN - 1)), "00:00");
  const rows = await orm
    .select({
      id: payments.id,
      sessionId: payments.sessionId,
      status: payments.status,
      amountCents: payments.amountCents,
      platformFeeCents: payments.feeCents,
      sessionStartsAt: sessions.startsAt,
      sessionStatus: sessions.status,
      subject: enrollments.subject,
      learnerName: learners.name,
      tutorId: tutors.id,
      tutorName: profiles.name,
    })
    .from(payments)
    .innerJoin(sessions, eq(sessions.id, payments.sessionId))
    .innerJoin(enrollments, eq(enrollments.id, sessions.enrollmentId))
    .innerJoin(learners, eq(learners.id, enrollments.learnerId))
    .innerJoin(tutors, eq(tutors.id, sessions.taughtBy))
    .innerJoin(profiles, eq(profiles.id, tutors.profileId))
    .where(gte(sessions.startsAt, since))
    .orderBy(desc(sessions.startsAt));

  return rows.map((row) => ({ ...row, tutorCents: row.amountCents - row.platformFeeCents }));
}

/**
 * What each tutor is owed per week, from the payments above. Refunded and
 * failed payments don't count. A week is "paid out" once a `payouts` row exists.
 */
export async function getWeeklyPayouts(lines: PaymentLine[]): Promise<PayoutWeek[]> {
  const counted = lines.filter((line) => line.status === "pending" || line.status === "succeeded");

  const tutorIds = [...new Set(counted.map((line) => line.tutorId))];
  const sent = tutorIds.length
    ? await orm.select({ tutorId: payouts.tutorId, periodStart: payouts.periodStart }).from(payouts).where(inArray(payouts.tutorId, tutorIds))
    : [];
  const isPaidOut = (tutorId: string, periodStart: string) =>
    sent.some((payout) => payout.tutorId === tutorId && payout.periodStart === periodStart);

  const weeks = new Map<string, Map<string, TutorWeek>>();
  for (const line of counted) {
    const periodStart = payoutWeekOf(line.sessionStartsAt);
    const week = weeks.get(periodStart) ?? new Map<string, TutorWeek>();
    const entry = week.get(line.tutorId) ?? {
      tutorId: line.tutorId,
      tutorName: line.tutorName,
      sessions: 0,
      owedCents: 0,
      paidOut: isPaidOut(line.tutorId, periodStart),
    };
    entry.sessions += 1;
    entry.owedCents += line.tutorCents;
    week.set(line.tutorId, entry);
    weeks.set(periodStart, week);
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([periodStart, week]) => {
      const tutorsInWeek = [...week.values()].sort((a, b) => a.tutorName.localeCompare(b.tutorName));
      return { periodStart, tutors: tutorsInWeek, totalCents: tutorsInWeek.reduce((sum, tutor) => sum + tutor.owedCents, 0) };
    });
}

/** Payments still waiting to be collected (for the sticky note). */
export async function countPendingPayments(): Promise<number> {
  const rows = await orm.select({ id: payments.id }).from(payments).where(eq(payments.status, "pending"));
  return rows.length;
}
