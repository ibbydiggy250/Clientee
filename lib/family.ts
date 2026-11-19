/**
 * What the family desk (Home, Sessions, Learners) shows for a parent or
 * learner. Read through `withUser`, so row-level security decides what this
 * person sees: their own learners, their account, the invites they sent.
 * (Moved here from app/home/page.tsx so several pages can share it.)
 */
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { accounts, enrollments, invites, learners, profiles, tutors } from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import { withUser } from "@/lib/db";

export type FamilyMatch = {
  enrollmentId: string;
  learnerId: string;
  subject: string;
  tutorName: string;
  inTrial: boolean;
};

export async function getFamilyDesk(user: SignedInUser) {
  return withUser(user.id, async (tx) => {
    const myLearners = await tx.select().from(learners).orderBy(learners.createdAt);
    const learnerIds = myLearners.map((learner) => learner.id);

    const allMatches = learnerIds.length
      ? await tx.select({ learnerId: enrollments.learnerId }).from(enrollments).where(inArray(enrollments.learnerId, learnerIds))
      : [];

    // Active matches with the tutor's name, for "Book" links and the to-do list.
    const activeMatches: FamilyMatch[] = learnerIds.length
      ? await tx
          .select({
            enrollmentId: enrollments.id,
            learnerId: enrollments.learnerId,
            subject: enrollments.subject,
            tutorName: profiles.name,
            inTrial: enrollments.inTrial,
          })
          .from(enrollments)
          .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
          .innerJoin(profiles, eq(profiles.id, tutors.profileId))
          .where(and(eq(enrollments.status, "active"), inArray(enrollments.learnerId, learnerIds)))
      : [];

    const [account] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.ownerId, user.id));
    const sentInvites = await tx
      .select()
      .from(invites)
      // Only invites that can still be accepted; expired ones aren't shown as live.
      .where(and(eq(invites.status, "pending"), gt(invites.expiresAt, sql`now()`)))
      .orderBy(desc(invites.createdAt));

    return {
      myLearners,
      matchedLearnerIds: new Set(allMatches.map((match) => match.learnerId)),
      activeMatches,
      ownsAccount: Boolean(account),
      sentInvites,
    };
  });
}

export type FamilyDesk = Awaited<ReturnType<typeof getFamilyDesk>>;
