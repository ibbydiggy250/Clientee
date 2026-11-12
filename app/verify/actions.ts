"use server";

/**
 * Checking the 6-digit email code, and sending a fresh one.
 * Neon Auth signs the person in automatically once the code is right.
 */
import { redirect } from "next/navigation";

import {
  forgetPendingVerification,
  readPendingVerification,
} from "@/lib/auth/pending-verification";
import { emailOtp } from "@/lib/auth/email-otp";
import { auth } from "@/lib/auth/server";

export type VerifyState = { error?: string; notice?: string };

export async function verifyCodeAction(_previous: VerifyState, form: FormData): Promise<VerifyState> {
  const pending = await readPendingVerification();
  if (!pending) return { error: "This page timed out. Sign in again to get a new code." };

  const otp = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(otp)) return { error: "Enter the 6-digit code from the email." };

  const { error } = await emailOtp.verifyEmail({ email: pending.email, otp });
  if (error) {
    return { error: "That code didn't work. Check the email again, or send a new code." };
  }

  await forgetPendingVerification();

  // Auto sign-in normally creates the session. If it didn't, ask them to sign in.
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect(`/sign-in?next=${encodeURIComponent(pending.next)}`);
  redirect(pending.next);
}

export async function resendCodeAction(): Promise<VerifyState> {
  const pending = await readPendingVerification();
  if (!pending) return { error: "This page timed out. Sign in again to get a new code." };

  const { error } = await emailOtp.sendVerificationOtp({
    email: pending.email,
    type: "email-verification",
  });
  if (error) return { error: "We couldn't send a new code just now. Try again in a minute." };
  return { notice: "A new code is on its way." };
}
