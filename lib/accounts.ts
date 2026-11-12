/**
 * Small building blocks for creating a client's profile and account.
 * Used by sign-up (lib/onboarding.ts) and by accepting invites (lib/invites.ts).
 * Both run as the database owner inside a transaction.
 */
import { accounts, profiles } from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import type { OwnerTransaction } from "@/lib/db";

/** Creates the user's client profile if it doesn't exist yet. */
export async function ensureClientProfile(tx: OwnerTransaction, user: SignedInUser) {
  await tx
    .insert(profiles)
    .values({ id: user.id, role: "client", name: user.name, email: user.email.toLowerCase() })
    .onConflictDoNothing();
}

/** Returns the user's account id, creating the account if needed. */
export async function ensureAccount(tx: OwnerTransaction, ownerId: string): Promise<string> {
  await tx.insert(accounts).values({ ownerId }).onConflictDoNothing();
  const account = await tx.query.accounts.findFirst({
    where: (table, { eq }) => eq(table.ownerId, ownerId),
  });
  if (!account) throw new Error("Account could not be created");
  return account.id;
}
