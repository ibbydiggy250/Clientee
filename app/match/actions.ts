"use server";

/**
 * Server Actions for matching: families searching and requesting, tutors
 * answering, admin approving, families recording the trial result, and
 * tutors editing their public profile. Each passes the signed-in user to
 * lib code that checks permissions.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AdminError } from "@/lib/admin";
import { getSignedInUser } from "@/lib/auth/current-user";
import {
  approveRequest,
  askForAnother,
  findTutors,
  MatchingError,
  recordTrialResult,
  rejectRequest,
  requestTutor,
  respondToRequest,
  searchSchema,
} from "@/lib/matching";
import {
  approveProfileDraft,
  draftSchema,
  matchingProfileSchema,
  rejectProfileDraft,
  saveProfileDraft,
  TutorProfileError,
  updateMatchingProfile,
} from "@/lib/tutor-profile";

export type MatchFormState = { error?: string; done?: boolean; message?: string };

async function signedInUser() {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Runs a step; known, fixable errors become a message on the form. */
async function attempt(task: () => Promise<MatchFormState | void>, ...pathsToRefresh: string[]): Promise<MatchFormState> {
  try {
    const result = await task();
    for (const path of ["/home", ...pathsToRefresh]) revalidatePath(path);
    return result ?? { done: true };
  } catch (problem) {
    if (problem instanceof MatchingError || problem instanceof TutorProfileError || problem instanceof AdminError) {
      return { error: problem.message };
    }
    throw problem;
  }
}

// ---------- Families ----------

export async function findTutorsAction(_previous: MatchFormState, form: FormData): Promise<MatchFormState> {
  const user = await signedInUser();
  const learnerId = String(form.get("learnerId") ?? "");

  let availability: unknown = [];
  try {
    availability = JSON.parse(String(form.get("availability") ?? "[]"));
  } catch {
    return { error: "Add at least one time that works each week" };
  }

  const input = searchSchema.safeParse({
    subject: form.get("subject"),
    level: form.get("level"),
    preferences: {
      availability,
      teachingStyle: form.get("teachingStyle") || "any",
      mainGoal: form.get("mainGoal") || undefined,
      tutorGender: form.get("tutorGender") || "any",
      notes: form.get("notes") ?? "",
    },
  });
  if (!input.success) return { error: input.error.issues[0].message };

  return attempt(async () => {
    const count = await findTutors(user, learnerId, input.data, new Date());
    return { done: true, message: count === 0 ? "none" : String(count) };
  }, `/match/${learnerId}`);
}

export async function askForAnotherAction(form: FormData): Promise<void> {
  const user = await signedInUser();
  const learnerId = String(form.get("learnerId") ?? "");
  try {
    await askForAnother(user, learnerId, String(form.get("subject") ?? ""), new Date());
  } catch (problem) {
    if (!(problem instanceof MatchingError)) throw problem;
  }
  revalidatePath(`/match/${learnerId}`);
}

export async function requestTutorAction(_previous: MatchFormState, form: FormData): Promise<MatchFormState> {
  const user = await signedInUser();
  const requestId = z.uuid().safeParse(form.get("requestId"));
  if (!requestId.success) return { error: "Missing suggestion." };
  return attempt(() => requestTutor(user, requestId.data, new Date()), `/match/${form.get("learnerId")}`);
}

export async function trialResultAction(_previous: MatchFormState, form: FormData): Promise<MatchFormState> {
  const user = await signedInUser();
  const input = z
    .object({ enrollmentId: z.uuid(), result: z.enum(["good", "not"]) })
    .safeParse({ enrollmentId: form.get("enrollmentId"), result: form.get("result") });
  if (!input.success) return { error: "Pick how the trial went." };
  const goodFit = input.data.result === "good";
  return attempt(async () => {
    await recordTrialResult(user, input.data.enrollmentId, goodFit, new Date());
    return { done: true, message: input.data.result };
  }, `/match/${form.get("learnerId")}`);
}

// ---------- Tutors ----------

export async function respondAction(_previous: MatchFormState, form: FormData): Promise<MatchFormState> {
  const user = await signedInUser();
  const input = z
    .object({ requestId: z.uuid(), decision: z.enum(["accept", "decline"]) })
    .safeParse({ requestId: form.get("requestId"), decision: form.get("decision") });
  if (!input.success) return { error: "Pick accept or decline." };
  return attempt(async () => {
    await respondToRequest(user, input.data.requestId, input.data.decision, new Date());
    return { done: true, message: input.data.decision };
  });
}

export async function saveProfileDraftAction(_previous: MatchFormState, form: FormData): Promise<MatchFormState> {
  const user = await signedInUser();
  const input = draftSchema.safeParse({ bio: form.get("bio") ?? "", introVideoUrl: form.get("introVideoUrl") ?? "" });
  if (!input.success) return { error: input.error.issues[0].message };
  return attempt(() => saveProfileDraft(user, input.data), "/profile", "/admin/tutors");
}

// ---------- Admin ----------

/** Admin approves or turns down a match request; errors show on the row. */
export async function decideMatchAction(_previous: MatchFormState, form: FormData): Promise<MatchFormState> {
  const user = await signedInUser();
  const input = z
    .object({ requestId: z.uuid(), decision: z.enum(["approve", "reject"]) })
    .safeParse({ requestId: form.get("requestId"), decision: form.get("decision") });
  if (!input.success) return { error: "Pick approve or decline." };

  return attempt(async () => {
    if (input.data.decision === "approve") await approveRequest(user, input.data.requestId, new Date());
    else await rejectRequest(user, input.data.requestId, new Date());
    return { done: true, message: input.data.decision };
  }, "/admin");
}

export async function updateMatchingProfileAction(_previous: MatchFormState, form: FormData): Promise<MatchFormState> {
  const user = await signedInUser();
  const input = matchingProfileSchema.safeParse({
    tutorId: form.get("tutorId"),
    levels: form.getAll("levels"),
    schoolYear: form.get("schoolYear") ?? "",
    maxLearners: form.get("maxLearners"),
    birthDate: form.get("birthDate") ?? "",
    gender: form.get("gender") ?? "",
    teachingStyles: form.getAll("teachingStyles"),
    goalFocus: form.getAll("goalFocus"),
  });
  if (!input.success) return { error: input.error.issues[0].message };
  return attempt(() => updateMatchingProfile(user, input.data), "/admin/tutors");
}

export async function profileDraftDecisionAction(form: FormData): Promise<void> {
  const user = await signedInUser();
  const tutorId = z.uuid().parse(form.get("tutorId"));
  if (form.get("decision") === "approve") {
    // Publish only the exact text admin read. If the tutor changed it since,
    // nothing is published and the page simply shows the newer draft.
    const reviewed = { bio: String(form.get("reviewedBio") ?? ""), introVideoUrl: String(form.get("reviewedVideo") ?? "") };
    try {
      await approveProfileDraft(user, tutorId, reviewed);
    } catch (problem) {
      if (!(problem instanceof TutorProfileError)) throw problem;
    }
  } else {
    await rejectProfileDraft(user, tutorId);
  }
  revalidatePath("/admin/tutors");
}
