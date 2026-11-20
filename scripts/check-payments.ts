/**
 * Checks the Zoom and Stripe stand-ins (lib/zoom.ts, lib/payments.ts).
 *
 * Part 1 needs no database: the 75/25 split, which sessions are charged,
 * payout weeks, and that Zoom and Stripe report "not connected".
 * Part 2 uses the dev branch: it creates throwaway sessions on an existing
 * match, records their outcomes, checks the payments that appear (and that
 * nothing is charged twice), then deletes everything it made.
 *
 *   TZ=UTC DATABASE_URL=<dev branch pooled url> npx tsx scripts/check-payments.ts
 */
import { eq, inArray } from "drizzle-orm";

import { accounts, enrollments, learners, payments, profiles, sessions, tutors } from "../db/schema";
import type { SignedInUser } from "../lib/auth/current-user";
import { cancelSession, recordOutcome } from "../lib/booking";
import { db, orm } from "../lib/db";
import { getTutorEarnings, getWeeklyPayouts, isChargeable, isStripeConnected, listRecentPayments, payoutWeekOf, recordSessionCharge, splitSessionPrice } from "../lib/payments";
import { isZoomConnected } from "../lib/zoom";

let failures = 0;
function check(description: string, passed: boolean) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${description}`);
  if (!passed) failures += 1;
}

function part1Rules() {
  console.log(`Running with TZ=${process.env.TZ ?? "(machine default)"}\n\nThe split`);
  const sixty = splitSessionPrice(6000, 75);
  check("$60 at 75% → $45 tutor, $15 TutorMe (spec example)", sixty.tutorCents === 4500 && sixty.platformFeeCents === 1500);
  const odd = splitSessionPrice(5999, 75);
  check("Odd cents never go missing (tutor + TutorMe = price)", odd.tutorCents + odd.platformFeeCents === 5999);
  check("A tutor at 80% gets $48 of $60", splitSessionPrice(6000, 80).tutorCents === 4800);

  console.log("\nWhich sessions are charged");
  check("Completed is charged", isChargeable({ status: "completed", cancelledLate: false }));
  check("No-show is charged", isChargeable({ status: "no_show", cancelledLate: false }));
  check("A late cancellation is charged", isChargeable({ status: "cancelled", cancelledLate: true }));
  check("Cancelling in time is free", !isChargeable({ status: "cancelled", cancelledLate: false }));
  check("A scheduled session isn't charged yet", !isChargeable({ status: "scheduled", cancelledLate: false }));

  console.log("\nPayout weeks (Monday, Eastern)");
  check("Wed Nov 18, 2026 → week of Mon Nov 16", payoutWeekOf(new Date("2026-11-18T20:00:00Z")) === "2026-11-16");
  check("Mon Nov 16 is its own week", payoutWeekOf(new Date("2026-11-16T15:00:00Z")) === "2026-11-16");
  check("Sun Nov 22 still belongs to the week of Nov 16", payoutWeekOf(new Date("2026-11-22T22:00:00Z")) === "2026-11-16");
  check("11 PM Sunday Eastern (04:00 UTC Monday) is still Sunday's week", payoutWeekOf(new Date("2026-11-23T04:00:00Z")) === "2026-11-16");

  console.log("\nStand-ins");
  check("Zoom reports not connected (no ZOOM_* settings)", !isZoomConnected());
  check("Stripe reports not connected (no STRIPE_SECRET_KEY)", !isStripeConnected());
}

async function part2WithDatabase() {
  console.log("\nRecording charges (dev branch)");

  const [match] = await orm
    .select({ enrollment: enrollments, tutorProfileId: tutors.profileId, holderId: accounts.ownerId, splitPct: tutors.splitPct })
    .from(enrollments)
    .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
    .innerJoin(learners, eq(learners.id, enrollments.learnerId))
    .innerJoin(accounts, eq(accounts.id, learners.accountId))
    .where(eq(enrollments.status, "active"))
    .limit(1);
  if (!match?.tutorProfileId) {
    console.log("SKIP  No active match with a tutor login on this branch.");
    return;
  }

  const asUser = async (id: string): Promise<SignedInUser> => {
    const [profile] = await orm.select().from(profiles).where(eq(profiles.id, id));
    return { id: profile.id, email: profile.email, name: profile.name };
  };
  const parent = await asUser(match.holderId);
  const tutor = await asUser(match.tutorProfileId);

  // Odd minutes so these never collide with real bookings on the hour.
  const now = new Date();
  const hour = 3_600_000;
  const starts = {
    completed: new Date(now.getTime() - 5 * hour - 13 * 60_000),
    lateCancel: new Date(now.getTime() + 3 * hour + 13 * 60_000),
    freeCancel: new Date(now.getTime() + 50 * hour + 13 * 60_000),
  };

  const created = await orm
    .insert(sessions)
    .values(
      Object.values(starts).map((startsAt) => ({
        enrollmentId: match.enrollment.id,
        taughtBy: match.enrollment.tutorId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + hour),
        priceCents: match.enrollment.rateCents,
      })),
    )
    .returning({ id: sessions.id });
  const [completedId, lateId, freeId] = created.map((row) => row.id);
  const allIds = [completedId, lateId, freeId];
  const paymentFor = async (sessionId: string) => orm.select().from(payments).where(eq(payments.sessionId, sessionId));

  try {
    await recordOutcome(tutor, completedId, "completed", now);
    const [completedPayment] = await paymentFor(completedId);
    const expected = splitSessionPrice(match.enrollment.rateCents, Number(match.splitPct));
    check("A completed session records one pending payment", completedPayment?.status === "pending");
    check("It's for the full price, with TutorMe's share as the fee",
      completedPayment?.amountCents === match.enrollment.rateCents && completedPayment?.feeCents === expected.platformFeeCents);

    await recordSessionCharge(completedId);
    check("Recording the same session again doesn't charge twice", (await paymentFor(completedId)).length === 1);

    await cancelSession(parent, lateId, now);
    check("A late family cancellation records a payment", (await paymentFor(lateId)).length === 1);

    await cancelSession(parent, freeId, now);
    check("Cancelling 2+ days ahead records nothing", (await paymentFor(freeId)).length === 0);

    const lines = await listRecentPayments(now);
    const weeks = await getWeeklyPayouts(lines);
    const ours = lines.filter((line) => allIds.includes(line.sessionId));
    check("The Money tab lists both charges", ours.length === 2);
    const tutorWeek = weeks.find((week) => week.periodStart === payoutWeekOf(starts.completed))?.tutors.find((entry) => entry.tutorId === match.enrollment.tutorId);
    check("The tutor's week includes what they're owed", (tutorWeek?.owedCents ?? 0) >= expected.tutorCents);
    check("Nothing is marked as paid out without Stripe", tutorWeek?.paidOut === false);

    const earnings = await getTutorEarnings(match.tutorProfileId, now);
    const earningLines = earnings?.lines ?? [];
    check("The tutor's Earnings tab shows both of these sessions", allIds.filter((id) => earningLines.some((line) => line.sessionId === id)).length === 2);
    check("It only ever shows their own sessions", earningLines.every((line) => line.tutorId === match.enrollment.tutorId));
    check("It shows their share, not the price", earningLines.find((line) => line.sessionId === completedId)?.tutorCents === expected.tutorCents);
    check("Someone who isn't a tutor gets no earnings", (await getTutorEarnings(match.holderId, now)) === null);

    const [zoomCheck] = await orm.select({ url: sessions.zoomJoinUrl }).from(sessions).where(eq(sessions.id, completedId));
    check("Without Zoom, sessions keep no join link", zoomCheck.url === null);
  } finally {
    await orm.delete(payments).where(inArray(payments.sessionId, allIds));
    await orm.delete(sessions).where(inArray(sessions.id, allIds));
  }
}

async function main() {
  part1Rules();
  await part2WithDatabase();
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
