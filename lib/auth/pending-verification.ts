/**
 * Remembers who is in the middle of verifying their email, between the
 * sign-up (or sign-in) screen and the /verify screen.
 *
 * Kept in a short-lived, httpOnly cookie rather than the URL, so the email
 * never shows up in browser history or server logs.
 */
import { cookies } from "next/headers";

import { safeNextPath } from "@/lib/safe-path";

const COOKIE_NAME = "tm_pending_verification";
const ONE_HOUR_IN_SECONDS = 60 * 60;

type PendingVerification = {
  email: string;
  /** Where to go once verified, e.g. "/home" or "/invite/<code>". */
  next: string;
};

export async function rememberPendingVerification(email: string, next: string) {
  const store = await cookies();
  const value: PendingVerification = { email: email.toLowerCase(), next: safeNextPath(next) };
  store.set(COOKIE_NAME, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_HOUR_IN_SECONDS,
  });
}

export async function readPendingVerification(): Promise<PendingVerification | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingVerification>;
    if (typeof parsed.email !== "string") return null;
    return { email: parsed.email, next: safeNextPath(parsed.next) };
  } catch {
    return null;
  }
}

export async function forgetPendingVerification() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
