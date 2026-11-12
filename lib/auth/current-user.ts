/**
 * Who is signed in, and do they have a TutorMe profile yet?
 *
 * The id and email always come from the Neon Auth session, never from a form,
 * so nobody can act as someone else by editing a request.
 */
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { profiles } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { orm } from "@/lib/db";

export type SignedInUser = { id: string; email: string; name: string };
export type Profile = typeof profiles.$inferSelect;

/** The signed-in Neon Auth user, or null when signed out. */
export async function getSignedInUser(): Promise<SignedInUser | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

/** The user's TutorMe profile, or null if onboarding never finished. */
export async function findProfile(userId: string): Promise<Profile | null> {
  const [profile] = await orm.select().from(profiles).where(eq(profiles.id, userId));
  return profile ?? null;
}

/**
 * For private pages: returns the user and their profile, or redirects.
 * Signed out → /sign-in. Signed in but no profile → /sign-up/finish.
 */
export async function requireProfile(): Promise<{ user: SignedInUser; profile: Profile }> {
  const user = await getSignedInUser();
  if (!user) redirect("/sign-in");

  const profile = await findProfile(user.id);
  if (!profile) redirect("/sign-up/finish");

  return { user, profile };
}
