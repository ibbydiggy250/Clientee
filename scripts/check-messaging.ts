/**
 * Checks messaging: the contact filter (no database), then threads, sending,
 * holding and admin review on the dev branch using an existing match whose
 * learner has no login (so the parent holds the learner's seat).
 * Messages this script sends are deleted at the end; the threads it creates
 * are the ones those people would get anyway, so they stay.
 *
 *   DATABASE_URL=<dev branch pooled url> npx tsx scripts/check-messaging.ts
 */
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { accounts, enrollments, learners, messages, profiles, tutors } from "../db/schema";
import type { SignedInUser } from "../lib/auth/current-user";
import { checkForContactInfo } from "../lib/contact-filter";
import { db, orm } from "../lib/db";
import { listThreads, MessagingError, openThread, pollThread, reviewHeldMessage, sendMessage } from "../lib/messaging";

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
    return problem instanceof MessagingError;
  }
}

function part1Filter() {
  console.log("Contact filter");
  const held = (text: string) => checkForContactInfo(text).hold;
  check("An email is held", held("write me at maya.k@gmail.com"));
  check("A spelled-out email is held", held("maya (at) gmail (dot) com"));
  check("A phone number with dashes is held", held("call 555-123-4567"));
  check("A phone number with brackets and spaces is held", held("(212) 555 0199"));
  check("An @handle is held", held("find me @maya_k"));
  check("Naming an outside app is held", held("add me on Snapchat"));
  check("A link is held", held("see mysite.com for more"));
  check("Ordinary tutoring talk goes through", !held("Can we review chapter 7 on Tuesday? I got 85% on the quiz."));
  check("Short numbers and times go through", !held("Let's meet at 4:30, problems 12-18 on page 214"));
  check("Admin sees why it was held", checkForContactInfo("text 555-123-4567 or me@x.com").reasons.join() === "email address,phone number");
}

async function part2Threads() {
  console.log("\nThreads and sending (dev branch)");

  // A match whose learner has no login: the parent holds the learner's seat.
  const [match] = await orm
    .select({ learnerId: learners.id, ownerId: accounts.ownerId, tutorProfileId: tutors.profileId })
    .from(enrollments)
    .innerJoin(learners, eq(learners.id, enrollments.learnerId))
    .innerJoin(accounts, eq(accounts.id, learners.accountId))
    .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
    .where(and(eq(enrollments.status, "active"), sql`${learners.profileId} is null`, sql`${tutors.profileId} is not null`))
    .limit(1);
  const [adminProfile] = await orm.select().from(profiles).where(eq(profiles.role, "admin")).limit(1);
  if (!match?.tutorProfileId || !adminProfile) {
    console.log("SKIP  Needs an active match with a no-login learner, and an admin.");
    return;
  }

  const asUser = async (id: string): Promise<SignedInUser> => {
    const [profile] = await orm.select().from(profiles).where(eq(profiles.id, id));
    return { id: profile.id, email: profile.email, name: profile.name };
  };
  const parent = await asUser(match.ownerId);
  const tutor = await asUser(match.tutorProfileId);
  const admin = await asUser(adminProfile.id);
  const [outsiderProfile] = await orm
    .select()
    .from(profiles)
    .where(and(eq(profiles.role, "client"), ne(profiles.id, parent.id)))
    .limit(1);

  const sentIds: string[] = [];
  const now = new Date();
  try {
    const parentThreads = await listThreads(parent);
    const tutorThread = parentThreads.find((thread) => thread.kind === "learner_tutor");
    check("The parent gets a TutorMe thread", parentThreads.some((thread) => thread.kind === "family_tutorme"));
    check("The parent gets the learner's tutor thread (no-login learner)", Boolean(tutorThread));
    if (!tutorThread) return;
    check("The parent can post in it (they hold the learner's seat)", tutorThread.canPost);
    check("Families see the tutor as first name + last initial", /^\S+ \S\.$/.test(tutorThread.title) || !tutorThread.title.includes(" "));

    const clean = await sendMessage(parent, tutorThread.id, "Could we focus on balancing equations next week?", now);
    sentIds.push(clean.messageId);
    check("A normal message is delivered", clean.status === "delivered");
    check("Sending returns a transaction id (ready for Realtime)", /^\d+$/.test(clean.txid));

    const flagged = await sendMessage(parent, tutorThread.id, "Easier to text me: 555-123-4567", now);
    sentIds.push(flagged.messageId);
    check("A message with a phone number is held", flagged.status === "held");

    const tutorSees = await pollThread(tutor, tutorThread.id, now);
    check("The tutor sees the delivered message", tutorSees.some((message) => message.id === clean.messageId));
    check("The tutor does not see the held one", !tutorSees.some((message) => message.id === flagged.messageId));

    const parentSees = await pollThread(parent, tutorThread.id, now);
    const ownHeld = parentSees.find((message) => message.id === flagged.messageId);
    check("The sender sees their own held message, marked held", ownHeld?.status === "held" && ownHeld.flagReason === "phone number");

    check("A tutor can't review held messages", await isRefused(() => reviewHeldMessage(tutor, flagged.messageId, "deliver", now)));
    await reviewHeldMessage(admin, flagged.messageId, "deliver", now);
    const afterReview = await pollThread(tutor, tutorThread.id, now);
    check("After admin delivers it, the tutor sees it", afterReview.some((message) => message.id === flagged.messageId));
    check("A message can't be reviewed twice", await isRefused(() => reviewHeldMessage(admin, flagged.messageId, "reject", now)));

    const adminView = await openThread(admin, tutorThread.id, now);
    check("Admin can read the learner ↔ tutor thread", adminView.messages.length >= 2);
    check("…but can't post in it", await isRefused(() => sendMessage(admin, tutorThread.id, "hello", now)));

    if (outsiderProfile) {
      const outsider = await asUser(outsiderProfile.id);
      check("Another family can't open this thread", await isRefused(() => openThread(outsider, tutorThread.id, now)));
      check("Another family can't post in it", await isRefused(() => sendMessage(outsider, tutorThread.id, "hi", now)));
    }

    const familyThread = parentThreads.find((thread) => thread.kind === "family_tutorme")!;
    check("A tutor can't open a family's TutorMe thread", await isRefused(() => openThread(tutor, familyThread.id, now)));
    const adminReply = await sendMessage(admin, familyThread.id, "Hi! TutorMe here — happy to help.", now);
    sentIds.push(adminReply.messageId);
    const familySees = await pollThread(parent, familyThread.id, now);
    check("Admin replies in a family thread show as \"TutorMe\"", familySees.find((m) => m.id === adminReply.messageId)?.senderLabel === "TutorMe");

    check("Empty messages are refused", await isRefused(() => sendMessage(parent, tutorThread.id, "   ", now)));
  } finally {
    if (sentIds.length) await orm.delete(messages).where(inArray(messages.id, sentIds));
  }
}

async function main() {
  part1Filter();
  await part2Threads();
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
