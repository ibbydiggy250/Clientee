/**
 * Page-level gate for the admin console.
 *
 * Signed out → sent to sign in, then brought back to /admin.
 * Signed in but not admin → null (the layout shows "staff only").
 *
 * This is a convenience for pages. The real check lives inside every
 * lib/admin.ts function (assertAdmin), which Server Actions also go through.
 */
import { redirect } from "next/navigation";

import { findProfile, getSignedInUser, type SignedInUser } from "@/lib/auth/current-user";

export async function getAdminActor(): Promise<SignedInUser | null> {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in?next=/admin");
  const profile = await findProfile(user.id);
  return profile?.role === "admin" ? user : null;
}

/** "$60" or "$62.50" from cents. */
export function dollars(cents: number): string {
  const amount = cents / 100;
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
