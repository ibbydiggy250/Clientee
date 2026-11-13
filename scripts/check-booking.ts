/**
 * Checks the booking rules: Eastern time maths (including daylight saving),
 * open-slot finding, the 24-hour rule and who can record outcomes.
 *
 * Part 1 needs no database. Part 2 uses the dev branch: it creates two
 * throwaway sessions on an existing match, checks the rules on them, and
 * deletes them again.
 *
 *   TZ=UTC DATABASE_URL=<dev branch pooled url> npx tsx scripts/check-booking.ts
 */
import { and, eq, inArray } from "drizzle-orm";

import { enrollments, profiles, sessions, tutors, accounts, learners } from "../db/schema";
import type { SignedInUser } from "../lib/auth/current-user";
import { BookingError, cancelSession, findOpenSlots, isWithinLateWindow, recordOutcome } from "../lib/booking";
import { db, orm } from "../lib/db";
import { addDays, easternClock, easternDate, easternMoment, weekdayOf } from "../lib/eastern-time";

let failures = 0;
function check(description: string, passed: boolean) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${description}`);
  if (!passed) failures += 1;
}

async function isRefused(task: () => Promise<unknown>): Promise<boolean> {
  try {
    await task();
    return false;
  } catch (problem) {
    return problem instanceof BookingError;
  }
}

function part1TimeAndSlots() {
  console.log(`Running with TZ=${process.env.TZ ?? "(machine default)"}\n\nEastern time`);
  check("3 PM on Nov 20, 2026 (EST) is 20:00 UTC", easternMoment("2026-11-20", "15:00").toISOString() === "2026-11-20T20:00:00.000Z");
  check("3 PM on Mar 8, 2027 (EST) is 20:00 UTC", easternMoment("2027-03-08", "15:00").toISOString() === "2027-03-08T20:00:00.000Z");
  check("3 PM on Mar 15, 2027 (EDT, after the clocks change) is 19:00 UTC", easternMoment("2027-03-15", "15:00").toISOString() === "2027-03-15T19:00:00.000Z");
  check("Round trip keeps the clock time across the change", easternClock(easternMoment("2027-03-15", "15:00")) === "15:00");
  check("Eastern date of 03:00 UTC Nov 21 is still Nov 20", easternDate(new Date("2026-11-21T03:00:00Z")) === "2026-11-20");
  check("Mar 15, 2027 is a Monday", weekdayOf("2027-03-15") === 1);
  check("Adding 7 days across the change lands on the next Monday", addDays("2027-03-08", 7) === "2027-03-15");

  console.log("\nFinding open slots");
  const monday3to5 = [{ weekday: 1, startTime: "15:00:00", endTime: "17:00:00" }];
  const now = new Date("2026-11-13T12:00:00Z"); // a Friday
  const base = { windows: monday3to5, busy: [], fromDate: "2026-11-13", days: 7, now, termEnd: null };

  const slots = findOpenSlots(base);
  check("A 3–5 PM Monday window gives two 60-minute slots", slots.length === 2 && slots[0].clock === "15:00" && slots[1].clock === "16:00");
  check("Both are on Monday Nov 16", slots.every((slot) => slot.date === "2026-11-16"));

  const busy = [{ startsAt: easternMoment("2026-11-16", "15:30"), endsAt: easternMoment("2026-11-16", "16:30") }];
  check("A booking from 3:30 to 4:30 blocks both overlapping slots", findOpenSlots({ ...base, busy }).length === 0);

  check("Nothing after the contract ends", findOpenSlots({ ...base, termEnd: "2026-11-15" }).length === 0);
  check("The contract's last day still counts", findOpenSlots({ ...base, termEnd: "2026-11-16" }).length === 2);

  const sundayNight = new Date("2026-11-16T09:00:00Z"); // 4 AM Monday Eastern
  const earlyMondaySlots = findOpenSlots({ ...base, now: sundayNight, fromDate: "2026-11-16", days: 1 });
  check(
    "At 4 AM, the 3 PM slot (11h away) is hidden; the 4 PM slot (12h away) is open",
    earlyMondaySlots.length === 1 && earlyMondaySlots[0].clock === "16:00",
  );

  check(
    "A weekly 3 PM slot stays at 3 PM Eastern after the clocks change",
    findOpenSlots({ ...base, fromDate: "2027-03-15", days: 1, now: new Date("2027-03-01T00:00:00Z") })[0]?.startsAt.toISOString() ===
      "2027-03-15T19:00:00.000Z",
  );

  console.log("\nThe 24-hour rule");
  const startsAt = new Date("2026-11-20T20:00:00Z");
  check("23 hours before is late", isWithinLateWindow(startsAt, new Date(startsAt.getTime() - 23 * 3_600_000)));
  check("25 hours before is not late", !isWithinLateWindow(startsAt, new Date(startsAt.getTime() - 25 * 3_600_000)));
}

async function part2WithDatabase() {
  console.log("\nCancelling and recording (dev branch)");

  // Any active match whose tutor and account holder both have logins.
  const [match] = await orm
    .select({ enrollment: enrollments, tutorProfileId: tutors.profileId, holderId: accounts.ownerId })
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

  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 3_600_000 + 7 * 60_000); // ~2 hours away
  const finished = new Date(now.getTime() - 3 * 3_600_000 - 7 * 60_000); // ended ~2 hours ago

  const created = await orm
    .insert(sessions)
    .values(
      [soon, finished].map((startsAt) => ({
        enrollmentId: match.enrollment.id,
        taughtBy: match.enrollment.tutorId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3_600_000),
        priceCents: match.enrollment.rateCents,
      })),
    )
    .returning({ id: sessions.id });
  const [soonId, finishedId] = created.map((row) => row.id);

  try {
    const result = await cancelSession(parent, soonId, now);
    check("A family cancelling 2 hours ahead is marked late (charged)", result.late === true);
    check("A cancelled session can't be cancelled again", await isRefused(() => cancelSession(parent, soonId, now)));

    check("A family can't record how a session went", await isRefused(() => recordOutcome(parent, finishedId, "completed", now)));
    check(
      "Nobody can record a session that hasn't ended",
      await isRefused(() => recordOutcome(tutor, finishedId, "completed", new Date(finished.getTime() + 30 * 60_000))),
    );
    await recordOutcome(tutor, finishedId, "no_show", now);
    const [recorded] = await orm.select({ status: sessions.status }).from(sessions).where(eq(sessions.id, finishedId));
    check("The tutor can record a no-show after it ends", recorded.status === "no_show");
    check("An outcome can't be recorded twice", await isRefused(() => recordOutcome(tutor, finishedId, "completed", now)));
  } finally {
    // Remove the two throwaway sessions again.
    await orm.delete(sessions).where(and(inArray(sessions.id, [soonId, finishedId])));
  }
}

async function main() {
  part1TimeAndSlots();
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
