/**
 * A learner's own page, opened from the Learners tab (added Nov 19, 2026).
 * Tutors and families see different things:
 *
 *   - Tutor (Clientee): teaching numbers (sessions taught, attendance, hours
 *     together), the family's goals and notes, past and upcoming sessions,
 *     and their own working notes per subject: strengths, things to work on,
 *     what to focus on next. Those notes are private to tutors and TutorMe.
 *   - Family: learning numbers (sessions done, hours learned, what's coming
 *     up), their tutors with a Book link, and the session history.
 *   - Progress charts are placeholders until session notes arrive (v1).
 *
 * Reads go through `withUser`, so row-level security decides what each
 * person may see. Learner notes are written as the database owner, so
 * saveLearnerNotes checks the tutor really teaches that learner the subject.
 */
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { enrollments, learnerNotes, learners, profiles, tutors } from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import { listSessionsInRange, type SessionListItem } from "@/lib/booking";
import { orm, withUser } from "@/lib/db";
import type { SavedPreferences } from "@/lib/matching-options";
import { publicTutorName } from "@/lib/public-name";

/** A problem the person can fix; its message is safe to show. */
export class LearnerPageError extends Error {}

const DAY = 24 * 60 * 60 * 1000;
/** How far ahead "upcoming" looks (weekly series are booked up to 12 weeks out). */
const LOOK_AHEAD_DAYS = 120;

// ---------------------------------------------------------------------------
// Numbers (pure, so they're easy to check)
// ---------------------------------------------------------------------------

export type LearnerNumbers = {
  completed: number;
  noShows: number;
  cancelled: number;
  upcoming: number;
  hours: number;
  /** Completed out of completed + no-shows, as a whole percent; null before the first one. */
  attendancePercent: number | null;
};

export function countSessions(items: SessionListItem[], now: Date): LearnerNumbers {
  const completed = items.filter((item) => item.status === "completed");
  const noShows = items.filter((item) => item.status === "no_show").length;
  const minutes = completed.reduce((sum, item) => sum + (item.endsAt.getTime() - item.startsAt.getTime()) / 60_000, 0);
  const attended = completed.length + noShows;
  return {
    completed: completed.length,
    noShows,
    cancelled: items.filter((item) => item.status === "cancelled").length,
    upcoming: items.filter((item) => item.status === "scheduled" && item.startsAt > now).length,
    hours: Math.round((minutes / 60) * 10) / 10,
    attendancePercent: attended === 0 ? null : Math.round((completed.length / attended) * 100),
  };
}

/** Every session of this learner the user may see, oldest first. */
async function sessionsOfLearner(user: SignedInUser, learnerId: string, now: Date): Promise<SessionListItem[]> {
  const all = await listSessionsInRange(user, new Date(0), new Date(now.getTime() + LOOK_AHEAD_DAYS * DAY));
  return all.filter((item) => item.learnerId === learnerId);
}

// ---------------------------------------------------------------------------
// The tutor's view
// ---------------------------------------------------------------------------

export type LearnerNote = { subject: string; strengths: string; weaknesses: string; nextFocus: string; updatedAt: Date | null };

export async function getTutorLearnerPage(user: SignedInUser, learnerId: string, now: Date) {
  const found = await withUser(user.id, async (tx) => {
    const [learner] = await tx
      .select({ id: learners.id, name: learners.name, grade: learners.grade, goals: learners.goals, baseline: learners.baseline, preferences: learners.preferences })
      .from(learners)
      .where(eq(learners.id, learnerId));
    // This tutor's active matches with the learner (one per subject).
    const subjects = await tx
      .select({ enrollmentId: enrollments.id, subject: enrollments.subject, inTrial: enrollments.inTrial })
      .from(enrollments)
      .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
      .where(and(eq(enrollments.learnerId, learnerId), eq(enrollments.status, "active"), eq(tutors.profileId, user.id)))
      .orderBy(enrollments.subject);
    return learner ? { learner, subjects } : null;
  });
  if (!found || found.subjects.length === 0) return null;

  const enrollmentIds = new Set(found.subjects.map((subject) => subject.enrollmentId));
  const sessions = (await sessionsOfLearner(user, learnerId, now)).filter((item) => enrollmentIds.has(item.enrollmentId));

  // Notes are keyed by subject (they carry over to the next tutor), read as owner after the check above.
  const savedNotes = await orm.select().from(learnerNotes).where(eq(learnerNotes.learnerId, learnerId));
  const notes: LearnerNote[] = found.subjects.map(({ subject }) => {
    const saved = savedNotes.find((note) => note.subject.toLowerCase() === subject.toLowerCase());
    return {
      subject,
      strengths: saved?.strengths ?? "",
      weaknesses: saved?.weaknesses ?? "",
      nextFocus: saved?.nextFocus ?? "",
      updatedAt: saved?.updatedAt ?? null,
    };
  });

  return {
    learner: { ...found.learner, preferences: found.learner.preferences as SavedPreferences },
    subjects: found.subjects,
    sessions,
    numbers: countSessions(sessions, now),
    notes,
  };
}

export type TutorLearnerPage = NonNullable<Awaited<ReturnType<typeof getTutorLearnerPage>>>;

export const learnerNotesSchema = z.object({
  learnerId: z.uuid(),
  subject: z.string().trim().min(1).max(40),
  strengths: z.string().trim().max(1500, "Keep each note under 1,500 characters").default(""),
  weaknesses: z.string().trim().max(1500, "Keep each note under 1,500 characters").default(""),
  nextFocus: z.string().trim().max(1500, "Keep each note under 1,500 characters").default(""),
});

/** Saves a tutor's notes on a learner for one subject they teach them. */
export async function saveLearnerNotes(user: SignedInUser, input: z.infer<typeof learnerNotesSchema>): Promise<void> {
  // Ask through row-level security: does this tutor have an active match for this learner and subject?
  const [match] = await withUser(user.id, (tx) =>
    tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
      .where(
        and(
          eq(enrollments.learnerId, input.learnerId),
          eq(enrollments.status, "active"),
          eq(tutors.profileId, user.id),
          sql`lower(${enrollments.subject}) = lower(${input.subject})`,
        ),
      ),
  );
  if (!match) throw new LearnerPageError("You can only write notes for learners you teach.");

  const fields = {
    strengths: input.strengths || null,
    weaknesses: input.weaknesses || null,
    nextFocus: input.nextFocus || null,
    updatedBy: user.id,
    updatedAt: new Date(),
  };
  const sameSubject = and(eq(learnerNotes.learnerId, input.learnerId), sql`lower(${learnerNotes.subject}) = lower(${input.subject})`);
  const updated = await orm.update(learnerNotes).set(fields).where(sameSubject).returning({ id: learnerNotes.id });
  if (updated.length === 0) await orm.insert(learnerNotes).values({ learnerId: input.learnerId, subject: input.subject, ...fields });
}

// ---------------------------------------------------------------------------
// The family's view
// ---------------------------------------------------------------------------

export async function getFamilyLearnerPage(user: SignedInUser, learnerId: string, now: Date) {
  const found = await withUser(user.id, async (tx) => {
    const [learner] = await tx.select().from(learners).where(eq(learners.id, learnerId));
    if (!learner) return null;
    const tutorsBySubject = await tx
      .select({ enrollmentId: enrollments.id, subject: enrollments.subject, inTrial: enrollments.inTrial, tutorName: profiles.name })
      .from(enrollments)
      .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
      .innerJoin(profiles, eq(profiles.id, tutors.profileId))
      .where(and(eq(enrollments.learnerId, learnerId), eq(enrollments.status, "active")))
      .orderBy(enrollments.subject);
    return { learner, tutorsBySubject };
  });
  if (!found) return null;

  const sessions = await sessionsOfLearner(user, learnerId, now);
  return {
    learner: found.learner,
    isMe: found.learner.profileId === user.id,
    // Families see tutors as "first name + last initial" (spec, "Tutor profiles").
    tutors: found.tutorsBySubject.map((match) => ({ ...match, tutorName: publicTutorName(match.tutorName) })),
    sessions,
    numbers: countSessions(sessions, now),
  };
}

export type FamilyLearnerPage = NonNullable<Awaited<ReturnType<typeof getFamilyLearnerPage>>>;
