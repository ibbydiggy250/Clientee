"use server";

/**
 * Server Actions behind the sign-up screens.
 *
 *   signUpAction       — creates the login (Neon Auth), then the TutorMe records.
 *   finishSignUpAction — for someone who has a login but whose sign-up broke
 *                        halfway; creates only the TutorMe records.
 *
 * With an invite code, sign-up only creates the login and then sends the
 * person to /invite/<code> to accept it.
 */
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth/server";
import { getSignedInUser, type SignedInUser } from "@/lib/auth/current-user";
import { rememberPendingVerification } from "@/lib/auth/pending-verification";
import { invitePath } from "@/lib/invites";
import { completeOnboarding, OnboardingError, onboardingSchema, signUpPath } from "@/lib/onboarding";

export type SignUpState = { error?: string };

const loginSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(80),
  email: z.email("That email doesn't look right").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters for your password").max(128),
});

/** Reads the sign-up answers out of the submitted form. */
function readAnswers(form: FormData) {
  return onboardingSchema.safeParse({
    path: signUpPath(form.get("role"), form.get("age")),
    parentEmail: form.get("parentEmail") || undefined,
    learner: {
      grade: form.get("grade") ?? "",
      subjects: form.get("subjects") ?? "",
      goals: form.get("goals") ?? "",
    },
  });
}

/** Neon Auth error → a sentence the person can act on. */
function friendlyAuthError(error: { code?: string; message?: string }): string {
  const isTaken =
    error.code === "USER_ALREADY_EXISTS" ||
    error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    /already exists/i.test(error.message ?? "");
  if (isTaken) {
    return "There's already an account with this email. Try signing in instead.";
  }
  if (error.code === "PASSWORD_TOO_SHORT") return "Use at least 8 characters for your password.";
  return error.message || "We couldn't create your account. Please try again.";
}

/** Creates the TutorMe records and returns where to go next. */
async function onboard(user: SignedInUser, answers: z.infer<typeof onboardingSchema>) {
  const result = await completeOnboarding(user, answers);
  return result.parentInviteCode ? "/home?parent-invite=created" : "/home";
}

export async function signUpAction(_previous: SignUpState, form: FormData): Promise<SignUpState> {
  const login = loginSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!login.success) return { error: login.error.issues[0].message };

  const inviteCode = String(form.get("invite") ?? "");

  // Check the answers BEFORE creating the login, so a mistake here never
  // leaves a login without a TutorMe profile.
  const answers = inviteCode ? null : readAnswers(form);
  if (answers && !answers.success) return { error: answers.error.issues[0].message };
  if (answers?.data.path === "minor-learner" && answers.data.parentEmail === login.data.email) {
    return { error: "Your parent's email has to be different from yours." };
  }

  const { data, error } = await auth.signUp.email(login.data);
  if (error || !data?.user) return { error: friendlyAuthError(error ?? {}) };

  const user: SignedInUser = { id: data.user.id, email: data.user.email, name: data.user.name };
  // With email verification on, Neon Auth gives no session until the code is entered.
  const hasSession = Boolean(data.token);

  if (inviteCode) return continueAfterSignUp(user.email, hasSession, invitePath(inviteCode));

  let next: string;
  try {
    next = await onboard(user, answers!.data);
  } catch (problem) {
    if (problem instanceof OnboardingError) return { error: problem.message };
    // The login exists, so send them to finish the rest.
    next = "/sign-up/finish";
  }
  return continueAfterSignUp(user.email, hasSession, next);
}

/** Goes to `next`, via the "check your email" screen when there is no session yet. */
async function continueAfterSignUp(email: string, hasSession: boolean, next: string): Promise<never> {
  if (!hasSession) {
    await rememberPendingVerification(email, next);
    redirect("/verify");
  }
  redirect(next);
}

export async function finishSignUpAction(_previous: SignUpState, form: FormData): Promise<SignUpState> {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");

  const answers = readAnswers(form);
  if (!answers.success) return { error: answers.error.issues[0].message };

  let next: string;
  try {
    next = await onboard(user, answers.data);
  } catch (problem) {
    if (problem instanceof OnboardingError) return { error: problem.message };
    return { error: "Something went wrong saving your details. Please try again." };
  }
  redirect(next);
}
