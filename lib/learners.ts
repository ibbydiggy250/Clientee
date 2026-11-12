/**
 * Account holders adding learners and giving them their own login.
 * Runs as the database owner, so each function checks ownership itself.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { accounts, learners } from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import { orm } from "@/lib/db";
import { createInvite } from "@/lib/invites";
import { learnerDetailsSchema } from "@/lib/onboarding";

/** A problem the person can fix; its message is safe to show. */
export class LearnerError extends Error {}

export const newLearnerSchema = learnerDetailsSchema
  .extend({
    name: z.string().trim().min(1, "Add the learner's name").max(80),
    isMinor: z.boolean(),
    // The parent ticks "I'm their parent or guardian and I consent".
    guardianConsent: z.boolean(),
  })
  .refine((learner) => !learner.isMinor || learner.guardianConsent, {
    message: "Please confirm you're their parent or guardian and consent to tutoring.",
  });

export type NewLearner = z.infer<typeof newLearnerSchema>;

async function findOwnAccountId(user: SignedInUser): Promise<string | null> {
  const [account] = await orm.select({ id: accounts.id }).from(accounts).where(eq(accounts.ownerId, user.id));
  return account?.id ?? null;
}

/** Adds a learner to the signed-in user's account. */
export async function addLearner(user: SignedInUser, learner: NewLearner): Promise<void> {
  const accountId = await findOwnAccountId(user);
  if (!accountId) throw new LearnerError("Only the account holder can add learners.");

  await orm.insert(learners).values({
    accountId,
    name: learner.name,
    grade: learner.grade || null,
    subjects: learner.subjects,
    goals: learner.goals || null,
    isMinor: learner.isMinor,
    // For a minor, the account holder's tick is their parental consent.
    consentGivenAt: learner.isMinor ? new Date() : null,
    consentGivenBy: learner.isMinor ? user.id : null,
  });
}

/**
 * Invites one of the user's learners to a login of their own.
 * Returns the invite code; the parent keeps full visibility either way.
 */
export async function inviteLearnerToLogin(user: SignedInUser, learnerId: string, email: string): Promise<string> {
  const accountId = await findOwnAccountId(user);
  if (!accountId) throw new LearnerError("Only the account holder can invite a learner.");

  const [learner] = await orm
    .select()
    .from(learners)
    .where(and(eq(learners.id, learnerId), eq(learners.accountId, accountId)));
  if (!learner) throw new LearnerError("That learner isn't on your account.");
  if (learner.profileId) throw new LearnerError(`${learner.name} already has their own login.`);
  if (email.toLowerCase() === user.email.toLowerCase()) {
    throw new LearnerError("Use the learner's own email, not yours.");
  }

  return orm.transaction((tx) =>
    createInvite(tx, { kind: "learner", email, learnerId, accountId, createdBy: user.id }),
  );
}
