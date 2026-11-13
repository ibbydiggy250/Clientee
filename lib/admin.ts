/**
 * Everything the admin console reads and changes.
 *
 * Every function takes the acting user and starts with `assertAdmin`, so the
 * check can't be skipped by calling a Server Action directly. After that
 * check the work runs as the database owner, because admin needs columns the
 * app_user role can't read (emails, pay).
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { accounts, enrollments, invites, learners, profiles, tutors } from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import { orm } from "@/lib/db";
import { createInvite } from "@/lib/invites";

/** A problem the admin can fix; its message is safe to show. */
export class AdminError extends Error {}

/** Throws unless the user's TutorMe profile has the admin role. */
export async function assertAdmin(actor: SignedInUser): Promise<void> {
  const [profile] = await orm.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, actor.id));
  if (profile?.role !== "admin") throw new AdminError("Only TutorMe staff can do that.");
}

/** Whole days from today until `isoDate` (negative once it has passed). */
export function daysUntil(isoDate: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10));
  return Math.round((new Date(isoDate).getTime() - today.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Intake and matching
// ---------------------------------------------------------------------------

export type IntakeLearner = {
  id: string;
  name: string;
  grade: string | null;
  subjects: string[];
  goals: string | null;
  isMinor: boolean;
  holderName: string | null;
  holderEmail: string | null;
  matches: { subject: string; tutorName: string; rateCents: number }[];
};

export type MatchableTutor = { id: string; name: string; subjects: string[] };

export async function getIntake(actor: SignedInUser) {
  await assertAdmin(actor);

  // Learners with an account (a parent, or an adult learner) can be matched.
  const linked = await orm
    .select({ learner: learners, holderName: profiles.name, holderEmail: profiles.email })
    .from(learners)
    .innerJoin(accounts, eq(accounts.id, learners.accountId))
    .innerJoin(profiles, eq(profiles.id, accounts.ownerId))
    .orderBy(learners.createdAt);

  // Minors who signed up alone and are still waiting for a parent to link.
  const waitingForParent = await orm
    .select({ id: learners.id, name: learners.name, grade: learners.grade, createdAt: learners.createdAt })
    .from(learners)
    .where(sql`${learners.accountId} is null`)
    .orderBy(learners.createdAt);

  const activeMatches = linked.length
    ? await orm
        .select({
          learnerId: enrollments.learnerId,
          subject: enrollments.subject,
          rateCents: enrollments.rateCents,
          tutorName: profiles.name,
        })
        .from(enrollments)
        .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
        .innerJoin(profiles, eq(profiles.id, tutors.profileId))
        .where(and(eq(enrollments.status, "active"), inArray(enrollments.learnerId, linked.map((row) => row.learner.id))))
    : [];

  const learnersForIntake: IntakeLearner[] = linked.map(({ learner, holderName, holderEmail }) => ({
    id: learner.id,
    name: learner.name,
    grade: learner.grade,
    subjects: learner.subjects,
    goals: learner.goals,
    isMinor: learner.isMinor,
    holderName,
    holderEmail,
    matches: activeMatches
      .filter((match) => match.learnerId === learner.id)
      .map(({ subject, tutorName, rateCents }) => ({ subject, tutorName, rateCents })),
  }));

  // Unmatched learners first: they're the queue.
  learnersForIntake.sort((a, b) => Number(a.matches.length > 0) - Number(b.matches.length > 0));

  const activeTutors: MatchableTutor[] = await orm
    .select({ id: tutors.id, name: profiles.name, subjects: tutors.subjects })
    .from(tutors)
    .innerJoin(profiles, eq(profiles.id, tutors.profileId))
    .where(eq(tutors.status, "active"))
    .orderBy(profiles.name);

  return { learners: learnersForIntake, waitingForParent, activeTutors };
}

export const matchSchema = z.object({
  learnerId: z.uuid(),
  tutorId: z.uuid("Pick a tutor"),
  subject: z.string().trim().min(1, "Name the subject").max(80),
  tier: z.enum(["standard", "premium"]),
  rateDollars: z.coerce.number().min(1, "Set an hourly rate").max(1000),
});

/** Matches a learner with an active tutor for one subject. */
export async function matchLearner(actor: SignedInUser, input: z.infer<typeof matchSchema>): Promise<void> {
  await assertAdmin(actor);

  const [learner] = await orm.select().from(learners).where(eq(learners.id, input.learnerId));
  if (!learner) throw new AdminError("That learner no longer exists.");
  // An unlinked minor has no parental consent yet; a tutor must not see them.
  if (!learner.accountId) throw new AdminError(`${learner.name} isn't linked to a parent yet, so they can't be matched.`);

  const [tutor] = await orm.select({ status: tutors.status }).from(tutors).where(eq(tutors.id, input.tutorId));
  if (tutor?.status !== "active") throw new AdminError("Only active tutors can be matched.");

  try {
    await orm.insert(enrollments).values({
      learnerId: input.learnerId,
      tutorId: input.tutorId,
      subject: input.subject,
      tier: input.tier,
      rateCents: Math.round(input.rateDollars * 100),
    });
  } catch (problem) {
    // The unique index allows one active match per learner and subject.
    if (isUniqueViolation(problem)) {
      throw new AdminError(`${learner.name} already has an active tutor for ${input.subject}.`);
    }
    throw problem;
  }
}

/** True if Postgres refused a row because of a unique rule (error 23505). */
function isUniqueViolation(problem: unknown): boolean {
  // Drizzle wraps the Postgres error, so look at the error and its cause.
  for (let error = problem; error; error = (error as { cause?: unknown }).cause) {
    if ((error as { code?: string }).code === "23505") return true;
  }
  return false;
}

/** Recently made matches, newest first. */
export async function getRecentMatches(actor: SignedInUser) {
  await assertAdmin(actor);
  return orm
    .select({
      id: enrollments.id,
      learnerName: learners.name,
      subject: enrollments.subject,
      tier: enrollments.tier,
      rateCents: enrollments.rateCents,
      tutorName: profiles.name,
      createdAt: enrollments.createdAt,
    })
    .from(enrollments)
    .innerJoin(learners, eq(learners.id, enrollments.learnerId))
    .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
    .innerJoin(profiles, eq(profiles.id, tutors.profileId))
    .where(eq(enrollments.status, "active"))
    .orderBy(desc(enrollments.createdAt))
    .limit(12);
}

// ---------------------------------------------------------------------------
// Tutor roster
// ---------------------------------------------------------------------------

export type RosterTutor = {
  id: string;
  name: string | null; // null until they accept the invite
  email: string | null;
  status: "invited" | "active" | "offboarding" | "inactive";
  subjects: string[];
  termStart: string | null;
  termEnd: string | null;
  activeLearners: number;
  pendingInviteCode: string | null;
};

export async function getRoster(actor: SignedInUser): Promise<RosterTutor[]> {
  await assertAdmin(actor);

  const rows = await orm
    .select({ tutor: tutors, name: profiles.name, email: profiles.email })
    .from(tutors)
    .leftJoin(profiles, eq(profiles.id, tutors.profileId))
    .orderBy(tutors.createdAt);

  const tutorIds = rows.map((row) => row.tutor.id);
  const pendingInvites = tutorIds.length
    ? await orm
        .select({ tutorId: invites.tutorId, email: invites.email, code: invites.code })
        .from(invites)
        .where(and(inArray(invites.tutorId, tutorIds), eq(invites.status, "pending"), sql`${invites.expiresAt} > now()`))
    : [];
  const learnerCounts = tutorIds.length
    ? await orm
        .select({ tutorId: enrollments.tutorId, count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(and(inArray(enrollments.tutorId, tutorIds), eq(enrollments.status, "active")))
        .groupBy(enrollments.tutorId)
    : [];

  return rows.map(({ tutor, name, email }) => {
    const invite = pendingInvites.find((candidate) => candidate.tutorId === tutor.id);
    return {
      id: tutor.id,
      name,
      email: email ?? invite?.email ?? null,
      status: tutor.status,
      subjects: tutor.subjects,
      termStart: tutor.termStart,
      termEnd: tutor.termEnd,
      activeLearners: learnerCounts.find((count) => count.tutorId === tutor.id)?.count ?? 0,
      pendingInviteCode: invite?.code ?? null,
    };
  });
}

const isoDate = z.iso.date("Use a full date");

export const tutorInviteSchema = z
  .object({
    email: z.email("That email doesn't look right").trim().toLowerCase(),
    subjects: z
      .string()
      .default("")
      .transform((text) => text.split(",").map((subject) => subject.trim()).filter(Boolean)),
    termStart: isoDate,
    termEnd: isoDate,
  })
  .refine((input) => input.termEnd > input.termStart, { message: "The term has to end after it starts." });

/**
 * Creates the tutor row (status "invited") and an invite for it.
 * Returns the invite code for the admin to pass on.
 */
export async function inviteTutor(actor: SignedInUser, input: z.infer<typeof tutorInviteSchema>): Promise<string> {
  await assertAdmin(actor);

  const [existing] = await orm.select({ role: profiles.role }).from(profiles).where(eq(profiles.email, input.email));
  if (existing && existing.role !== "tutor") {
    throw new AdminError("That email belongs to a family or staff login. Tutors need their own email.");
  }

  return orm.transaction(async (tx) => {
    const [tutor] = await tx
      .insert(tutors)
      .values({ status: "invited", subjects: input.subjects, termStart: input.termStart, termEnd: input.termEnd })
      .returning({ id: tutors.id });
    return createInvite(tx, { kind: "tutor", email: input.email, tutorId: tutor.id, createdBy: actor.id });
  });
}

/** Sends a fresh invite (e.g. the email was mistyped), cancelling the old one. */
export async function reissueTutorInvite(actor: SignedInUser, tutorId: string, email: string): Promise<string> {
  await assertAdmin(actor);
  return orm.transaction(async (tx) => {
    const [tutor] = await tx.select().from(tutors).where(eq(tutors.id, tutorId));
    if (!tutor || tutor.status !== "invited") throw new AdminError("Only tutors who haven't joined yet can get a new invite.");
    await tx
      .update(invites)
      .set({ status: "revoked" })
      .where(and(eq(invites.tutorId, tutorId), eq(invites.status, "pending")));
    return createInvite(tx, { kind: "tutor", email, tutorId, createdBy: actor.id });
  });
}

export const tutorTermSchema = z.object({
  tutorId: z.uuid(),
  termEnd: isoDate,
  status: z.enum(["active", "offboarding", "inactive"]),
});

/** Extends or ends a contract, and moves a tutor between statuses. */
export async function updateTutorTerm(actor: SignedInUser, input: z.infer<typeof tutorTermSchema>): Promise<void> {
  await assertAdmin(actor);
  const [tutor] = await orm.select().from(tutors).where(eq(tutors.id, input.tutorId));
  if (!tutor) throw new AdminError("That tutor no longer exists.");
  if (tutor.status === "invited") throw new AdminError("This tutor hasn't joined yet. Edit their invite instead.");
  if (tutor.termStart && input.termEnd <= tutor.termStart) {
    throw new AdminError("The term has to end after it starts.");
  }
  await orm.update(tutors).set({ termEnd: input.termEnd, status: input.status }).where(eq(tutors.id, input.tutorId));
}
