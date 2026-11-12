"use server";

/** Server Actions used on the home screen. Each checks the session itself. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth/server";
import { getSignedInUser } from "@/lib/auth/current-user";
import { addLearner, inviteLearnerToLogin, LearnerError, newLearnerSchema } from "@/lib/learners";

export type FormState = { error?: string; done?: boolean };

export async function signOutAction() {
  await auth.signOut();
  redirect("/sign-in");
}

export async function addLearnerAction(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");

  const learner = newLearnerSchema.safeParse({
    name: form.get("name"),
    grade: form.get("grade") ?? "",
    subjects: form.get("subjects") ?? "",
    goals: form.get("goals") ?? "",
    isMinor: form.get("isMinor") === "yes",
    guardianConsent: form.get("guardianConsent") === "yes",
  });
  if (!learner.success) return { error: learner.error.issues[0].message };

  try {
    await addLearner(user, learner.data);
  } catch (problem) {
    if (problem instanceof LearnerError) return { error: problem.message };
    throw problem;
  }
  revalidatePath("/home");
  return { done: true };
}

const inviteSchema = z.object({
  learnerId: z.uuid(),
  email: z.email("That email doesn't look right").trim().toLowerCase(),
});

export async function inviteLearnerAction(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");

  const input = inviteSchema.safeParse({ learnerId: form.get("learnerId"), email: form.get("email") });
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    await inviteLearnerToLogin(user, input.data.learnerId, input.data.email);
  } catch (problem) {
    if (problem instanceof LearnerError) return { error: problem.message };
    throw problem;
  }
  revalidatePath("/home");
  return { done: true };
}
