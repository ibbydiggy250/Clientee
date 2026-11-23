/**
 * What Clientee (the tutor's desk) shows: contract, matched learners,
 * sessions, waiting match requests and unread messages.
 * Learner reads go through `withUser`, so row-level security limits them to
 * active matches, and only while the contract allows (migration 0005).
 * (Moved here from app/home/TutorHome.tsx so several pages can share it.)
 */
import { eq } from "drizzle-orm";

import { availability, enrollments, learners, tutors } from "@/db/schema";
import type { Profile, SignedInUser } from "@/lib/auth/current-user";
import { listVisibleSessions } from "@/lib/booking";
import { orm, withUser } from "@/lib/db";
import { getTutorRequests } from "@/lib/matching";
import { countUnread } from "@/lib/messaging";

/** The free-text notes a family left when finding a tutor, if any. */
export function familyNotes(preferences: unknown): string {
  const notes = (preferences as { notes?: unknown } | null)?.notes;
  return typeof notes === "string" ? notes.trim() : "";
}

export async function getTutorDesk(profile: Profile, now: Date) {
  const me: SignedInUser = { id: profile.id, email: profile.email, name: profile.name };

  const { tutor, matches } = await withUser(profile.id, async (tx) => {
    // Only the columns tutors (and matched families) may read.
    const [tutor] = await tx
      .select({ id: tutors.id, status: tutors.status, subjects: tutors.subjects, termStart: tutors.termStart, termEnd: tutors.termEnd, bio: tutors.bio })
      .from(tutors)
      .where(eq(tutors.profileId, profile.id));

    const matches = await tx
      .select({
        id: enrollments.id,
        learnerId: enrollments.learnerId,
        subject: enrollments.subject,
        inTrial: enrollments.inTrial,
        learnerName: learners.name,
        grade: learners.grade,
        goals: learners.goals,
        // The family's free-text notes. Tutors only see learners after admin
        // approves the match, which is when these notes may be shared.
        preferences: learners.preferences,
      })
      .from(enrollments)
      .innerJoin(learners, eq(learners.id, enrollments.learnerId))
      .where(eq(enrollments.status, "active"))
      .orderBy(learners.name);

    return { tutor, matches };
  });

  const hoursCount = tutor
    ? (await orm.select({ id: availability.id }).from(availability).where(eq(availability.tutorId, tutor.id))).length
    : 0;

  return {
    tutor,
    matches,
    hasHours: hoursCount > 0,
    sessions: await listVisibleSessions(me, now),
    requests: await getTutorRequests(me, now),
    unread: await countUnread(me),
    contractEnded: tutor?.status === "inactive",
  };
}

export type TutorDesk = Awaited<ReturnType<typeof getTutorDesk>>;
