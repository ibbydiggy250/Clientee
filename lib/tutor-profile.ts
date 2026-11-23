/**
 * Tutor profiles for matching (mvp-spec.md, "Tutor profiles").
 *
 *   - Tutors write their own bio and intro-video link as DRAFTS. They go live
 *     on suggestion cards only after admin approves them (no contact-info
 *     filter exists yet; decided Nov 13, 2026).
 *   - Admin sets the matching fields: levels, school and year, learner cap,
 *     birth date, gender, teaching styles, goals they're good at.
 *   - Since Nov 19, 2026 tutors can also edit most of those themselves
 *     ("profile details": subjects, levels, school, styles, goals, learner
 *     cap, languages, fun fact). Like the bio, their edits are drafts until
 *     admin approves them. Birth date and gender stay admin-only.
 *
 * Runs as the database owner, so each function checks who is asking.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";

import { profiles, tutors } from "@/db/schema";
import { assertAdmin } from "@/lib/admin";
import type { SignedInUser } from "@/lib/auth/current-user";
import { orm } from "@/lib/db";
import { detailsFingerprint, liveDetailsOf, normalizeDetails, pendingDetailsOf, type ProfileDetails } from "@/lib/profile-details";

export { detailsSchema, type ProfileDetails } from "@/lib/profile-details";

/** A problem the person can fix; its message is safe to show. */
export class TutorProfileError extends Error {}

// ---------------------------------------------------------------------------
// The tutor's own public profile (drafts)
// ---------------------------------------------------------------------------

export const draftSchema = z.object({
  bio: z.string().trim().max(1200, "Keep the bio under 1,200 characters").default(""),
  introVideoUrl: z
    .union([z.literal(""), z.url("That doesn't look like a web link").trim().refine((url) => url.startsWith("https://"), "Use a secure link (https://)")])
    .default(""),
});

async function myTutorRow(user: SignedInUser) {
  const [tutor] = await orm.select().from(tutors).where(eq(tutors.profileId, user.id));
  if (!tutor) throw new TutorProfileError("Only tutors have a public profile.");
  return tutor;
}

export async function getMyPublicProfile(user: SignedInUser) {
  const tutor = await myTutorRow(user);
  const pendingDetails = pendingDetailsOf(tutor);
  return {
    bio: tutor.bio,
    introVideoUrl: tutor.introVideoUrl,
    bioDraft: tutor.bioDraft,
    introVideoUrlDraft: tutor.introVideoUrlDraft,
    hasPendingChanges: tutor.bioDraft !== null || tutor.introVideoUrlDraft !== null || pendingDetails !== null,
    schoolYear: tutor.schoolYear,
    subjects: tutor.subjects,
    levels: tutor.levels,
    languages: tutor.languages,
    funFact: tutor.funFact,
    /** What's live now, and the tutor's pending edits (null if none). */
    details: liveDetailsOf(tutor),
    pendingDetails,
  };
}

/**
 * Saves the tutor's bio / video edits as drafts for admin to approve.
 * If they match what's already live, there's nothing to approve, so any
 * pending draft is cleared instead.
 */
export async function saveProfileDraft(user: SignedInUser, draft: z.infer<typeof draftSchema>): Promise<void> {
  const tutor = await myTutorRow(user);
  const isUnchanged = draft.bio === (tutor.bio ?? "") && draft.introVideoUrl === (tutor.introVideoUrl ?? "");
  await orm
    .update(tutors)
    .set(isUnchanged ? { bioDraft: null, introVideoUrlDraft: null } : { bioDraft: draft.bio, introVideoUrlDraft: draft.introVideoUrl })
    .where(eq(tutors.id, tutor.id));
}

// ---------------------------------------------------------------------------
// The tutor's profile details (drafts, approved by admin)
// ---------------------------------------------------------------------------

/** Saves the tutor's detail edits for admin to approve (or clears the draft if nothing changed). */
export async function saveDetailsDraft(user: SignedInUser, details: ProfileDetails): Promise<void> {
  const tutor = await myTutorRow(user);
  const isUnchanged = detailsFingerprint(details) === detailsFingerprint(liveDetailsOf(tutor));
  await orm
    .update(tutors)
    .set({ profileDraft: isUnchanged ? null : normalizeDetails(details) })
    .where(eq(tutors.id, tutor.id));
}

// ---------------------------------------------------------------------------
// Admin: matching fields and draft approval
// ---------------------------------------------------------------------------

export const matchingProfileSchema = z.object({
  tutorId: z.uuid(),
  levels: z.array(z.enum(["elementary", "middle_school", "high_school", "ap", "sat_act", "college"])),
  schoolYear: z.string().trim().max(80).default(""),
  maxLearners: z.coerce.number().int().min(1, "At least 1 learner").max(40),
  birthDate: z.union([z.literal(""), z.iso.date("Use a full date")]).default(""),
  gender: z.enum(["", "female", "male"]).default(""),
  teachingStyles: z.array(z.enum(["patient", "structured", "challenging"])),
  goalFocus: z.array(z.enum(["homework", "catch_up", "get_ahead", "test_prep"])),
});

export async function updateMatchingProfile(actor: SignedInUser, input: z.infer<typeof matchingProfileSchema>): Promise<void> {
  await assertAdmin(actor);
  await orm
    .update(tutors)
    .set({
      levels: input.levels,
      schoolYear: input.schoolYear || null,
      maxLearners: input.maxLearners,
      birthDate: input.birthDate || null,
      gender: input.gender || null,
      teachingStyles: input.teachingStyles,
      goalFocus: input.goalFocus,
    })
    .where(eq(tutors.id, input.tutorId));
}

/**
 * Publishes a tutor's pending bio / video link — but only if it is still
 * exactly what admin reviewed, so a last-second edit can't slip through.
 */
export async function approveProfileDraft(
  actor: SignedInUser,
  tutorId: string,
  reviewed: { bio: string; introVideoUrl: string },
): Promise<void> {
  await assertAdmin(actor);
  const [tutor] = await orm.select().from(tutors).where(eq(tutors.id, tutorId));
  if (!tutor) throw new TutorProfileError("That tutor no longer exists.");
  if ((tutor.bioDraft ?? "") !== reviewed.bio || (tutor.introVideoUrlDraft ?? "") !== reviewed.introVideoUrl) {
    throw new TutorProfileError("The tutor changed their bio after you opened it. Please review the new version.");
  }
  await orm
    .update(tutors)
    .set({
      bio: tutor.bioDraft ?? tutor.bio,
      introVideoUrl: tutor.introVideoUrlDraft === null ? tutor.introVideoUrl : tutor.introVideoUrlDraft || null,
      bioDraft: null,
      introVideoUrlDraft: null,
    })
    .where(eq(tutors.id, tutorId));
}

/** Throws away a tutor's pending bio / video link (the live one stays). */
export async function rejectProfileDraft(actor: SignedInUser, tutorId: string): Promise<void> {
  await assertAdmin(actor);
  await orm.update(tutors).set({ bioDraft: null, introVideoUrlDraft: null }).where(eq(tutors.id, tutorId));
}

/**
 * Publishes a tutor's pending profile details, but only if they are still
 * exactly what admin reviewed (same idea as approveProfileDraft).
 */
export async function approveDetailsDraft(actor: SignedInUser, tutorId: string, reviewedFingerprint: string): Promise<void> {
  await assertAdmin(actor);
  const [tutor] = await orm.select().from(tutors).where(eq(tutors.id, tutorId));
  if (!tutor) throw new TutorProfileError("That tutor no longer exists.");
  const pending = pendingDetailsOf(tutor);
  if (!pending) throw new TutorProfileError("There are no profile changes waiting for this tutor.");
  if (detailsFingerprint(pending) !== reviewedFingerprint) {
    throw new TutorProfileError("The tutor changed their profile after you opened it. Please review the new version.");
  }
  await orm
    .update(tutors)
    .set({
      subjects: pending.subjects,
      levels: pending.levels,
      schoolYear: pending.schoolYear || null,
      teachingStyles: pending.teachingStyles,
      goalFocus: pending.goalFocus,
      maxLearners: pending.maxLearners,
      languages: pending.languages,
      funFact: pending.funFact || null,
      profileDraft: null,
    })
    .where(eq(tutors.id, tutorId));
}

/** Throws away a tutor's pending profile details (the live ones stay). */
export async function rejectDetailsDraft(actor: SignedInUser, tutorId: string): Promise<void> {
  await assertAdmin(actor);
  await orm.update(tutors).set({ profileDraft: null }).where(eq(tutors.id, tutorId));
}

/** Everything admin needs to edit one tutor's matching profile. */
export async function getTutorForAdmin(actor: SignedInUser, tutorId: string) {
  await assertAdmin(actor);
  const [row] = await orm
    .select({ tutor: tutors, name: profiles.name })
    .from(tutors)
    .leftJoin(profiles, eq(profiles.id, tutors.profileId))
    .where(eq(tutors.id, tutorId));
  return row ?? null;
}
