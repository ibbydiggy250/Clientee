/**
 * Creates a new client's TutorMe records right after they sign up.
 *
 * Runs as the database owner (trusted server code), in one transaction, so a
 * half-finished sign-up never leaves stray rows behind. Safe to call twice:
 * if the profile already exists, it does nothing.
 *
 * The three sign-up paths from mvp-spec.md ("Client sign-up"):
 *   - Parent              → profile + account. Learners are added afterwards.
 *   - Learner, 18 or over → profile + account + learner (they are their own account holder).
 *   - Learner, under 18   → profile + learner with no account yet, and an invite
 *                           for their parent. Booking stays locked until the parent links.
 */
import { z } from "zod";

import { learners } from "@/db/schema";
import { ensureAccount, ensureClientProfile } from "@/lib/accounts";
import type { SignedInUser } from "@/lib/auth/current-user";
import { orm } from "@/lib/db";
import { createInvite } from "@/lib/invites";

// ---------------------------------------------------------------------------
// What the sign-up form sends
// ---------------------------------------------------------------------------

/** Turns "Maths, SAT prep" into ["Maths", "SAT prep"]. */
const subjectList = z
  .string()
  .default("")
  .transform((text) =>
    text
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean),
  );

export const learnerDetailsSchema = z.object({
  grade: z.string().trim().max(40).default(""),
  subjects: subjectList,
  goals: z.string().trim().max(2000).default(""),
});

/** The three sign-up paths. Each has its own name so the form can't mix them up. */
export const onboardingSchema = z.discriminatedUnion(
  "path",
  [
    z.object({ path: z.literal("parent") }),
    z.object({
      path: z.literal("adult-learner"),
      learner: learnerDetailsSchema,
    }),
    z.object({
      path: z.literal("minor-learner"),
      learner: learnerDetailsSchema,
      parentEmail: z.email("Enter your parent's email address").trim().toLowerCase(),
    }),
  ],
  { error: "Pick who you are on the first step." },
);

/** Turns the first step's two answers into one of the three paths. */
export function signUpPath(role: unknown, age: unknown): string | undefined {
  if (role === "parent") return "parent";
  if (role === "learner" && age === "adult") return "adult-learner";
  if (role === "learner" && age === "minor") return "minor-learner";
  return undefined;
}

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;

export type OnboardingResult = {
  /** Set for under-18 learners: the code of the invite for their parent. */
  parentInviteCode?: string;
};

// ---------------------------------------------------------------------------
// The main entry point
// ---------------------------------------------------------------------------

export async function completeOnboarding(
  user: SignedInUser,
  answers: OnboardingAnswers,
): Promise<OnboardingResult> {
  return orm.transaction(async (tx) => {
    const existing = await tx.query.profiles.findFirst({
      where: (table, { eq }) => eq(table.id, user.id),
    });
    if (existing) return {}; // already onboarded; nothing to do

    await ensureClientProfile(tx, user);

    if (answers.path === "parent") {
      await ensureAccount(tx, user.id);
      return {};
    }

    const details = {
      name: user.name,
      profileId: user.id,
      grade: answers.learner.grade || null,
      subjects: answers.learner.subjects,
      goals: answers.learner.goals || null,
    };

    if (answers.path === "adult-learner") {
      const accountId = await ensureAccount(tx, user.id);
      await tx.insert(learners).values({ ...details, accountId, isMinor: false });
      return {};
    }

    // Under 18: no account until a parent accepts the invite.
    if (answers.parentEmail === user.email.toLowerCase()) {
      throw new OnboardingError("Your parent's email has to be different from yours.");
    }
    const [learner] = await tx
      .insert(learners)
      .values({ ...details, accountId: null, isMinor: true })
      .returning({ id: learners.id });

    const parentInviteCode = await createInvite(tx, {
      kind: "parent",
      email: answers.parentEmail,
      learnerId: learner.id,
      createdBy: user.id,
    });
    return { parentInviteCode };
  });
}

/** A problem the person can fix; its message is safe to show them. */
export class OnboardingError extends Error {}
