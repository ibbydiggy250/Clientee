"use server";

/** Server Actions for the learner page: a tutor saving their notes on a learner. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSignedInUser } from "@/lib/auth/current-user";
import { LearnerPageError, learnerNotesSchema, saveLearnerNotes } from "@/lib/learner-page";

export type LearnerFormState = { error?: string; done?: boolean };

export async function saveLearnerNotesAction(_previous: LearnerFormState, form: FormData): Promise<LearnerFormState> {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");

  const input = learnerNotesSchema.safeParse({
    learnerId: form.get("learnerId"),
    subject: form.get("subject"),
    strengths: form.get("strengths") ?? "",
    weaknesses: form.get("weaknesses") ?? "",
    nextFocus: form.get("nextFocus") ?? "",
  });
  if (!input.success) return { error: input.error.issues[0].message };

  try {
    await saveLearnerNotes(user, input.data);
  } catch (problem) {
    if (problem instanceof LearnerPageError) return { error: problem.message };
    throw problem;
  }
  revalidatePath(`/learners/${input.data.learnerId}`);
  return { done: true };
}
