"use server";

import { redirect } from "next/navigation";

import { rememberPendingVerification } from "@/lib/auth/pending-verification";
import { auth } from "@/lib/auth/server";
import { safeNextPath } from "@/lib/safe-path";

export type SignInState = { error?: string };

export async function signInAction(_previous: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const next = safeNextPath(form.get("next"));

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    // Right password, but the email was never verified. Neon Auth has just
    // emailed a fresh code, so send them to enter it.
    const needsVerification =
      error.code === "EMAIL_NOT_VERIFIED" ||
      error.code === "EMAIL_VERIFICATION_REQUIRED" ||
      /not verified|verification required/i.test(error.message ?? "");
    if (needsVerification) {
      await rememberPendingVerification(email, next);
      redirect("/verify");
    }
    return error.code === "INVALID_EMAIL_OR_PASSWORD"
      ? { error: "That email and password don't match. Try again." }
      : { error: error.message || "We couldn't sign you in. Please try again." };
  }

  redirect(next);
}
