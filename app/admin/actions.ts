"use server";

/**
 * Admin console Server Actions. Each one gets the signed-in user and hands
 * it to lib/admin.ts, which refuses anyone who isn't an admin.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  AdminError,
  inviteTutor,
  matchLearner,
  matchSchema,
  reissueTutorInvite,
  tutorInviteSchema,
  tutorTermSchema,
  updateTutorTerm,
} from "@/lib/admin";
import { getSignedInUser } from "@/lib/auth/current-user";

export type AdminFormState = { error?: string; done?: boolean; inviteCode?: string };

async function signedInActor() {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in?next=/admin");
  return user;
}

/** Runs an admin task; AdminError becomes a message on the form. */
async function run(task: () => Promise<AdminFormState | void>, page: string): Promise<AdminFormState> {
  try {
    const result = await task();
    revalidatePath(page);
    return result ?? { done: true };
  } catch (problem) {
    if (problem instanceof AdminError) return { error: problem.message };
    throw problem;
  }
}

export async function matchLearnerAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const actor = await signedInActor();
  const input = matchSchema.safeParse({
    learnerId: form.get("learnerId"),
    tutorId: form.get("tutorId"),
    subject: form.get("subject"),
    tier: form.get("tier"),
    rateDollars: form.get("rateDollars"),
  });
  if (!input.success) return { error: input.error.issues[0].message };
  return run(() => matchLearner(actor, input.data), "/admin");
}

export async function inviteTutorAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const actor = await signedInActor();
  const input = tutorInviteSchema.safeParse({
    email: form.get("email"),
    subjects: form.get("subjects") ?? "",
    termStart: form.get("termStart"),
    termEnd: form.get("termEnd"),
  });
  if (!input.success) return { error: input.error.issues[0].message };
  return run(async () => ({ done: true, inviteCode: await inviteTutor(actor, input.data) }), "/admin/tutors");
}

const reissueSchema = z.object({
  tutorId: z.uuid(),
  email: z.email("That email doesn't look right").trim().toLowerCase(),
});

export async function reissueTutorInviteAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const actor = await signedInActor();
  const input = reissueSchema.safeParse({ tutorId: form.get("tutorId"), email: form.get("email") });
  if (!input.success) return { error: input.error.issues[0].message };
  return run(
    async () => ({ done: true, inviteCode: await reissueTutorInvite(actor, input.data.tutorId, input.data.email) }),
    "/admin/tutors",
  );
}

export async function updateTutorTermAction(_previous: AdminFormState, form: FormData): Promise<AdminFormState> {
  const actor = await signedInActor();
  const input = tutorTermSchema.safeParse({
    tutorId: form.get("tutorId"),
    termEnd: form.get("termEnd"),
    status: form.get("status"),
  });
  if (!input.success) return { error: input.error.issues[0].message };
  return run(() => updateTutorTerm(actor, input.data), "/admin/tutors");
}
