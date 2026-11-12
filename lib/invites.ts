/**
 * Invites: the only way two people get linked (mvp-spec.md, "Client sign-up").
 *
 *   parent  — a minor asks a parent to link up. Accepting gives the learner an
 *             account and records the parent's consent.
 *   learner — a parent gives one of their learners a login of their own.
 *   tutor   — admin invites a tutor (built in the admin slice, not here yet).
 *
 * There is no email sender yet, so the app shows the invite link on screen
 * for the inviter to pass on. Only the person whose email the invite was
 * sent to can accept it.
 *
 * All of this runs as the database owner, so every function checks
 * permissions itself.
 */
import { randomBytes } from "node:crypto";

import { and, eq, gt, sql } from "drizzle-orm";

import { invites, learners } from "@/db/schema";
import { ensureAccount, ensureClientProfile } from "@/lib/accounts";
import type { SignedInUser } from "@/lib/auth/current-user";
import { orm, type OwnerTransaction } from "@/lib/db";
import { maskEmail } from "@/lib/mask-email";

const INVITE_LIFETIME_DAYS = 14;

/** A long random code that can't be guessed (24 characters, URL-safe). */
function newInviteCode(): string {
  return randomBytes(18).toString("base64url");
}

/** The path people open to accept an invite. */
export function invitePath(code: string): string {
  return `/invite/${code}`;
}

type NewInvite = {
  kind: "parent" | "learner";
  email: string;
  learnerId: string;
  createdBy: string;
  accountId?: string;
};

/** Saves a pending invite and returns its code. */
export async function createInvite(tx: OwnerTransaction, invite: NewInvite): Promise<string> {
  const code = newInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  await tx.insert(invites).values({
    kind: invite.kind,
    email: invite.email.toLowerCase(),
    code,
    learnerId: invite.learnerId,
    accountId: invite.accountId ?? null,
    createdBy: invite.createdBy,
    expiresAt,
  });
  return code;
}

// ---------------------------------------------------------------------------
// Showing an invite to whoever opened the link
// ---------------------------------------------------------------------------

export type InviteSummary = {
  kind: "tutor" | "parent" | "learner";
  /** "pending" means it can still be accepted. */
  state: "pending" | "accepted" | "expired" | "revoked";
  /** The invited address, partly hidden: "ja•••@example.com". */
  maskedEmail: string;
  learnerName: string | null;
  inviterName: string | null;
};

/** What the invite page shows. The invited email is only shown partly hidden. */
export async function findInvite(code: string): Promise<InviteSummary | null> {
  const invite = await orm.query.invites.findFirst({
    where: (table, { eq }) => eq(table.code, code),
  });
  if (!invite) return null;

  const learner = invite.learnerId
    ? await orm.query.learners.findFirst({ where: (table, { eq }) => eq(table.id, invite.learnerId!) })
    : null;
  const inviter = invite.createdBy
    ? await orm.query.profiles.findFirst({ where: (table, { eq }) => eq(table.id, invite.createdBy!) })
    : null;

  const isPastExpiry = invite.expiresAt.getTime() < Date.now();
  return {
    kind: invite.kind,
    state: invite.status === "pending" && isPastExpiry ? "expired" : invite.status,
    maskedEmail: maskEmail(invite.email),
    learnerName: learner?.name ?? null,
    inviterName: inviter?.name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Accepting an invite
// ---------------------------------------------------------------------------

/** A reason the invite can't be accepted; the message is safe to show. */
export class InviteError extends Error {}

/**
 * Accepts the invite for the signed-in user, all or nothing.
 * Throws InviteError with a readable message when it can't be accepted.
 */
export async function acceptInvite(user: SignedInUser, code: string): Promise<void> {
  await orm.transaction(async (tx) => {
    // Claim the invite in one step, so two clicks can't both accept it.
    const [invite] = await tx
      .update(invites)
      .set({ status: "accepted" })
      .where(
        and(
          eq(invites.code, code),
          eq(invites.status, "pending"),
          gt(invites.expiresAt, sql`now()`),
          eq(invites.email, user.email.toLowerCase()),
        ),
      )
      .returning();

    if (!invite) {
      throw new InviteError(await whyInviteCannotBeAccepted(user, code));
    }
    if (invite.kind === "tutor" || !invite.learnerId) {
      throw new InviteError("Tutor invites aren't open yet.");
    }

    await ensureClientProfile(tx, user);

    if (invite.kind === "parent") {
      await linkParent(tx, user, invite.learnerId);
    } else {
      await linkLearnerLogin(tx, user, invite.learnerId);
    }
  });
}

/** Parent accepts: the minor joins the parent's account, consent is recorded. */
async function linkParent(tx: OwnerTransaction, user: SignedInUser, learnerId: string) {
  const accountId = await ensureAccount(tx, user.id);
  const linked = await tx
    .update(learners)
    .set({ accountId, consentGivenAt: new Date(), consentGivenBy: user.id })
    .where(and(eq(learners.id, learnerId), sql`${learners.accountId} is null`))
    .returning({ id: learners.id });

  if (linked.length === 0) {
    throw new InviteError("This learner is already linked to a parent.");
  }
}

/** Learner accepts: their new login is attached to the learner profile. */
async function linkLearnerLogin(tx: OwnerTransaction, user: SignedInUser, learnerId: string) {
  const alreadyALearner = await tx.query.learners.findFirst({
    where: (table, { eq }) => eq(table.profileId, user.id),
  });
  if (alreadyALearner) {
    throw new InviteError("This login already belongs to a learner. Sign in with a different email.");
  }

  const linked = await tx
    .update(learners)
    .set({ profileId: user.id })
    .where(and(eq(learners.id, learnerId), sql`${learners.profileId} is null`))
    .returning({ id: learners.id });

  if (linked.length === 0) {
    throw new InviteError("This learner already has their own login.");
  }
}

/** Works out a friendly reason after the claim step found nothing. */
async function whyInviteCannotBeAccepted(user: SignedInUser, code: string): Promise<string> {
  const invite = await orm.query.invites.findFirst({
    where: (table, { eq }) => eq(table.code, code),
  });
  if (!invite) return "This invite link isn't valid.";
  if (invite.status === "accepted") return "This invite has already been used.";
  if (invite.status === "revoked") return "This invite was cancelled.";
  if (invite.expiresAt.getTime() < Date.now()) return "This invite has expired. Ask for a new one.";
  if (invite.email !== user.email.toLowerCase()) {
    return `This invite was sent to ${maskEmail(invite.email)}. Sign in with that email to accept it.`;
  }
  return "This invite can't be accepted right now.";
}
