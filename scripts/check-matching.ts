/**
 * Checks rule-based matching.
 *
 * Part 1 (no database): hard filters, the scoring weights, rotation and
 * tie-breaking, with made-up tutors.
 * Part 2 (dev branch): the request steps end to end — suggest, request,
 * accept, approve, trial rules, expiry — using a throwaway tutor and an
 * existing family. Everything it creates is removed afterwards, and the
 * learner's saved answers are put back.
 *
 *   TZ=UTC DATABASE_URL=<dev branch pooled url> npx tsx scripts/check-matching.ts
 */
import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { accounts, availability, enrollments, learners, matchRequests, profiles, sessions, tutors } from "../db/schema";
import type { SignedInUser } from "../lib/auth/current-user";
import { BookingError, bookSessions } from "../lib/booking";
import { db, orm } from "../lib/db";
import { easternMoment } from "../lib/eastern-time";
import { matchLearner } from "../lib/admin";
import {
  approveRequest,
  askForAnother,
  type Candidate,
  findTutors,
  MatchingError,
  rankCandidates,
  recordTrialResult,
  rejectRequest,
  requestTutor,
  respondToRequest,
  scoreCandidate,
  type TutorSearch,
  WEIGHTS,
  whyNotEligible,
} from "../lib/matching";
import { publicTutorName } from "../lib/public-name";

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
    return problem instanceof MatchingError || problem instanceof BookingError;
  }
}

// ---------------------------------------------------------------------------
// Part 1
// ---------------------------------------------------------------------------

const now = new Date("2026-11-13T15:00:00Z");

const search: TutorSearch = {
  subject: "Chemistry",
  level: "high_school",
  preferences: {
    availability: [{ weekday: 1, startTime: "15:00", endTime: "18:00" }],
    teachingStyle: "patient",
    mainGoal: "catch_up",
    tutorGender: "any",
    notes: "",
  },
};

function tutor(overrides: Partial<Candidate>): Candidate {
  return {
    id: "t-base",
    status: "active",
    subjects: ["Chemistry"],
    levels: ["high_school"],
    birthDate: "2000-01-01",
    gender: "female",
    teachingStyles: ["patient"],
    goalFocus: ["catch_up"],
    maxLearners: 5,
    activeLearners: 0,
    totalMatches: 10,
    lastMatchedAt: null,
    windows: [{ weekday: 1, startTime: "16:00", endTime: "19:00" }],
    ...overrides,
  };
}

function part1() {
  console.log("Hard filters");
  check("A full match is eligible", whyNotEligible(tutor({}), search, now) === null);
  check("Subject is matched case-insensitively", whyNotEligible(tutor({ subjects: ["chemistry"] }), search, now) === null);
  check("Wrong subject is filtered out", whyNotEligible(tutor({ subjects: ["Physics"] }), search, now) !== null);
  check("Wrong level is filtered out", whyNotEligible(tutor({ levels: ["college"] }), search, now) !== null);
  check("Inactive tutors are filtered out", whyNotEligible(tutor({ status: "offboarding" }), search, now) !== null);
  check("Tutors at their cap are filtered out", whyNotEligible(tutor({ activeLearners: 5 }), search, now) !== null);
  check("Under-18 tutors are filtered out", whyNotEligible(tutor({ birthDate: "2009-06-01" }), search, now) !== null);
  check("Tutors without a birth date on file are filtered out", whyNotEligible(tutor({ birthDate: null }), search, now) !== null);
  check(
    "Only half an hour in common isn't enough",
    whyNotEligible(tutor({ windows: [{ weekday: 1, startTime: "17:30", endTime: "20:00" }] }), search, now) !== null,
  );
  check(
    "Same hours on a different weekday don't count",
    whyNotEligible(tutor({ windows: [{ weekday: 2, startTime: "15:00", endTime: "18:00" }] }), search, now) !== null,
  );

  console.log("\nScoring");
  const perfect = scoreCandidate(tutor({}), search, now);
  check(
    "A full preference match with all slots free scores the fit + capacity points",
    perfect === WEIGHTS.teachingStyle + WEIGHTS.mainGoal + WEIGHTS.tutorGender + WEIGHTS.openCapacity,
  );
  check("A style mismatch costs the style points", scoreCandidate(tutor({ teachingStyles: ["challenging"] }), search, now) === perfect - WEIGHTS.teachingStyle);
  check("New tutors get a boost", scoreCandidate(tutor({ totalMatches: 1 }), search, now) === perfect + WEIGHTS.newTutor);
  check(
    "Tutors matched in the last week drop, so matches rotate",
    scoreCandidate(tutor({ lastMatchedAt: new Date("2026-11-11T12:00:00Z") }), search, now) === perfect + WEIGHTS.recentlyMatched,
  );
  check(
    "A gender preference only scores when it matches",
    scoreCandidate(tutor({ gender: "male" }), { ...search, preferences: { ...search.preferences, tutorGender: "female" } }, now) ===
      perfect - WEIGHTS.tutorGender,
  );

  console.log("\nRanking");
  const ranked = rankCandidates(
    [
      tutor({ id: "b-busy", activeLearners: 4 }),
      tutor({ id: "a-free" }),
      tutor({ id: "c-wrong-subject", subjects: ["Art"] }),
      tutor({ id: "d-recent", lastMatchedAt: new Date("2026-11-12T12:00:00Z") }),
    ],
    search,
    now,
  );
  check("Ineligible tutors never appear", !ranked.some((pick) => pick.tutorId === "c-wrong-subject"));
  check("More open capacity ranks higher", ranked[0]?.tutorId === "a-free");
  check("A recently matched tutor ranks below an equal one", ranked.findIndex((p) => p.tutorId === "d-recent") > 0);
  check("Excluded tutors (already tried) are left out", !rankCandidates([tutor({ id: "x" })], search, now, new Set(["x"])).length);
  const tie = rankCandidates([tutor({ id: "z-2" }), tutor({ id: "a-1" })], search, now);
  check("Exact ties are broken by id, so order is stable", tie[0]?.tutorId === "a-1");

  console.log("\nPublic names");
  check("Families see first name + last initial", publicTutorName("Theo Tutor") === "Theo T.");
  check("A single name stays as is", publicTutorName("Ana") === "Ana");
}

// ---------------------------------------------------------------------------
// Part 2
// ---------------------------------------------------------------------------

async function part2() {
  console.log("\nRequest steps (dev branch)");

  // An existing family whose learner has an account.
  const [family] = await orm
    .select({ learner: learners, ownerId: accounts.ownerId })
    .from(learners)
    .innerJoin(accounts, eq(accounts.id, learners.accountId))
    .limit(1);
  if (!family) {
    console.log("SKIP  No linked learner on this branch.");
    return;
  }
  const [ownerProfile] = await orm.select().from(profiles).where(eq(profiles.id, family.ownerId));
  const parent: SignedInUser = { id: ownerProfile.id, email: ownerProfile.email, name: ownerProfile.name };
  const savedLearner = { preferences: family.learner.preferences, subjects: family.learner.subjects };

  const [adminProfile] = await orm.select().from(profiles).where(eq(profiles.role, "admin")).limit(1);
  if (!adminProfile) {
    console.log("SKIP  No admin on this branch (approval needs one).");
    return;
  }
  const admin: SignedInUser = { id: adminProfile.id, email: adminProfile.email, name: adminProfile.name };

  // A throwaway tutor who is the only one teaching some made-up subjects
  // (one per scenario below, so the scenarios don't affect each other).
  const subject = `Checkology ${randomUUID().slice(0, 6)}`;
  const scenarioSubject = (letter: string) => `${subject} ${letter}`;
  const tutorProfileId = randomUUID();
  await orm.insert(profiles).values({ id: tutorProfileId, role: "tutor", name: "Check Tutor", email: `${tutorProfileId}@example.test` });
  const tutorUser: SignedInUser = { id: tutorProfileId, email: `${tutorProfileId}@example.test`, name: "Check Tutor" };
  const [fakeTutor] = await orm
    .insert(tutors)
    .values({
      profileId: tutorProfileId,
      status: "active",
      subjects: [subject, ...["B", "C", "D", "E"].map(scenarioSubject)],
      levels: ["high_school"],
      birthDate: "1999-05-05",
      maxLearners: 3,
    })
    .returning({ id: tutors.id });
  await orm.insert(availability).values({ tutorId: fakeTutor.id, weekday: 2, startTime: "15:00", endTime: "19:00" });

  const thisSearch: TutorSearch = { ...search, subject, preferences: { ...search.preferences, availability: [{ weekday: 2, startTime: "16:00", endTime: "18:00" }] } };
  const realNow = new Date();

  try {
    const count = await findTutors(parent, family.learner.id, thisSearch, realNow);
    check("A search suggests the one eligible tutor", count === 1);

    const [suggestion] = await orm.select().from(matchRequests).where(and(eq(matchRequests.tutorId, fakeTutor.id), eq(matchRequests.status, "suggested")));
    check("A tutor can't accept a request the family hasn't made", await isRefused(() => respondToRequest(tutorUser, suggestion.id, "accept", realNow)));

    await requestTutor(parent, suggestion.id, realNow);
    check("Requesting twice is refused", await isRefused(() => requestTutor(parent, suggestion.id, realNow)));
    check("Another family member can't answer for the tutor", await isRefused(() => respondToRequest(parent, suggestion.id, "accept", realNow)));

    const afterDeadline = new Date(realNow.getTime() + 49 * 3_600_000);
    check("Accepting after 48 hours is refused", await isRefused(() => respondToRequest(tutorUser, suggestion.id, "accept", afterDeadline)));

    // The check above expired it. Start again for the happy path.
    await orm.update(matchRequests).set({ status: "requested", decidedAt: null }).where(eq(matchRequests.id, suggestion.id));
    await respondToRequest(tutorUser, suggestion.id, "accept", realNow);
    check("Accepting twice is refused", await isRefused(() => respondToRequest(tutorUser, suggestion.id, "accept", realNow)));

    check("A family can't approve their own match", await isRefused(() => approveRequest(parent, suggestion.id, realNow)));
    await approveRequest(admin, suggestion.id, realNow);
    const [approved] = await orm.select().from(matchRequests).where(eq(matchRequests.id, suggestion.id));
    const [enrollment] = await orm.select().from(enrollments).where(eq(enrollments.id, approved.enrollmentId!));
    check("Approval creates an active enrollment, in trial", enrollment?.status === "active" && enrollment.inTrial === true);
    check("Approving twice is refused", await isRefused(() => approveRequest(admin, suggestion.id, realNow)));
    check(
      "A second tutor can't be searched for a subject that already has one",
      await isRefused(() => findTutors(parent, family.learner.id, thisSearch, realNow)),
    );

    // Trial booking rules. Find the next Tuesday 4 PM Eastern, at least a day away.
    let day = new Date(realNow.getTime() + 2 * 86_400_000);
    while (day.getUTCDay() !== 2) day = new Date(day.getTime() + 86_400_000);
    const tuesday4pm = easternMoment(day.toISOString().slice(0, 10), "16:00");
    check(
      "A weekly repeat is refused while in trial",
      await isRefused(() => bookSessions(parent, { enrollmentId: enrollment.id, startsAt: tuesday4pm, repeatWeekly: true }, realNow)),
    );
    await bookSessions(parent, { enrollmentId: enrollment.id, startsAt: tuesday4pm, repeatWeekly: false }, realNow);
    const [trialSession] = await orm.select().from(sessions).where(eq(sessions.enrollmentId, enrollment.id));
    check("The first session is marked as the trial", trialSession?.isTrial === true);
    check(
      "A second session is refused while in trial",
      await isRefused(() =>
        bookSessions(parent, { enrollmentId: enrollment.id, startsAt: new Date(tuesday4pm.getTime() + 3_600_000), repeatWeekly: false }, realNow),
      ),
    );

    // After the trial: the family says how it went.
    check(
      "The trial result can't be given before the trial is over",
      await isRefused(() => recordTrialResult(parent, enrollment.id, true, realNow)),
    );
    const afterTrial = new Date(tuesday4pm.getTime() + 2 * 3_600_000);
    await recordTrialResult(parent, enrollment.id, false, afterTrial);
    const [afterNotAFit] = await orm.select().from(enrollments).where(eq(enrollments.id, enrollment.id));
    check("\"Not a fit\" ends the match", afterNotAFit.status === "ended" && afterNotAFit.inTrial === false);
    check("The result can't be given twice", await isRefused(() => recordTrialResult(parent, enrollment.id, true, afterTrial)));

    check("A new search for the same subject leaves out this tutor", (await findTutors(parent, family.learner.id, thisSearch, realNow)) === 0);

    // Helper for the scenarios below: search, then return the one suggestion.
    const suggestFor = async (letter: string) => {
      const scenarioSearch = { ...thisSearch, subject: scenarioSubject(letter) };
      await findTutors(parent, family.learner.id, scenarioSearch, realNow);
      const [row] = await orm
        .select()
        .from(matchRequests)
        .where(and(eq(matchRequests.subject, scenarioSearch.subject), eq(matchRequests.status, "suggested")));
      return { search: scenarioSearch, suggestion: row };
    };
    const statusOf = async (requestId: string) =>
      (await orm.select({ status: matchRequests.status }).from(matchRequests).where(eq(matchRequests.id, requestId)))[0]?.status;

    console.log("\nOther paths (dev branch)");

    // B: the tutor declines → a new search leaves them out, and admin is told nobody fit.
    const b = await suggestFor("B");
    await requestTutor(parent, b.suggestion.id, realNow);
    await respondToRequest(tutorUser, b.suggestion.id, "decline", realNow);
    check("A tutor can decline a request", (await statusOf(b.suggestion.id)) === "declined");
    check("After a decline, the next search skips that tutor", (await findTutors(parent, family.learner.id, b.search, realNow)) === 0);
    const [afterB] = await orm.select({ preferences: learners.preferences }).from(learners).where(eq(learners.id, family.learner.id));
    check(
      "A search that finds nobody is recorded for admin to match by hand",
      (afterB.preferences as { unmetSearch?: { subject?: string } }).unmetSearch?.subject === b.search.subject,
    );

    // C: admin turns a waiting request down.
    const c = await suggestFor("C");
    await requestTutor(parent, c.suggestion.id, realNow);
    check("A family can't turn down a request as admin", await isRefused(() => rejectRequest(parent, c.suggestion.id, realNow)));
    await rejectRequest(admin, c.suggestion.id, realNow);
    check("Admin can turn down a waiting request", (await statusOf(c.suggestion.id)) === "declined");

    // D: "show me someone else" sets today's suggestions aside.
    const d = await suggestFor("D");
    check("\"Show me someone else\" finds nobody new when there's no one left", (await askForAnother(parent, family.learner.id, d.search.subject, realNow)) === 0);
    check("…and the skipped suggestion is set aside", (await statusOf(d.suggestion.id)) === "skipped");

    // E: a hand match closes an open request for the same subject.
    const e = await suggestFor("E");
    await requestTutor(parent, e.suggestion.id, realNow);
    await matchLearner(admin, { learnerId: family.learner.id, tutorId: fakeTutor.id, subject: e.search.subject, tier: "standard", rateDollars: 60 });
    check("A hand match closes the open request for that subject", (await statusOf(e.suggestion.id)) === "cancelled");
  } finally {
    // Remove everything this script created, and restore the learner's answers.
    const created = await orm.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.tutorId, fakeTutor.id));
    await orm.delete(matchRequests).where(eq(matchRequests.tutorId, fakeTutor.id));
    if (created.length) {
      await orm.delete(sessions).where(inArray(sessions.enrollmentId, created.map((row) => row.id)));
      await orm.delete(enrollments).where(inArray(enrollments.id, created.map((row) => row.id)));
    }
    await orm.delete(availability).where(eq(availability.tutorId, fakeTutor.id));
    await orm.delete(tutors).where(eq(tutors.id, fakeTutor.id));
    await orm.delete(profiles).where(eq(profiles.id, tutorProfileId));
    await orm.update(learners).set(savedLearner).where(eq(learners.id, family.learner.id));
  }
}

async function main() {
  part1();
  await part2();
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
