/**
 * Server-side email codes (Neon Auth's Email OTP endpoints).
 *
 * `auth.emailOtp` exists at runtime (it's in @neon/auth's endpoint list:
 * "email-otp/verify-email" and "email-otp/send-verification-otp"), but the
 * installed @neon/auth 0.8 types it as `unknown`. This file gives it the
 * shape we use, in one place, so the rest of the app stays fully typed.
 */
import { auth } from "@/lib/auth/server";

type AuthResult = Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

type EmailOtpApi = {
  /** Checks the 6-digit code; with auto sign-in on, it also starts a session. */
  verifyEmail(input: { email: string; otp: string }): AuthResult;
  /** Emails a fresh code. */
  sendVerificationOtp(input: { email: string; type: "email-verification" }): AuthResult;
};

export const emailOtp = auth.emailOtp as EmailOtpApi;
