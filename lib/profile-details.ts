/**
 * The parts of a tutor's profile they can edit themselves (besides bio and
 * video), and helpers to compare versions. Pure: no database, no auth, so
 * lib/tutor-profile.ts and lib/admin.ts can both use it without importing
 * each other. (Added Nov 19, 2026.)
 */
import { z } from "zod";

import type { tutors } from "@/db/schema";

const LEVEL_VALUES = ["elementary", "middle_school", "high_school", "ap", "sat_act", "college"] as const;
const STYLE_VALUES = ["patient", "structured", "challenging"] as const;
const GOAL_VALUES = ["homework", "catch_up", "get_ahead", "test_prep"] as const;

export const detailsSchema = z.object({
  subjects: z
    .array(z.string().trim().min(1).max(40, "Keep each subject under 40 characters"))
    .min(1, "Add at least one subject")
    .max(12, "Up to 12 subjects"),
  levels: z.array(z.enum(LEVEL_VALUES)).min(1, "Pick at least one level"),
  schoolYear: z.string().trim().max(80, "Keep school and year short").default(""),
  teachingStyles: z.array(z.enum(STYLE_VALUES)),
  goalFocus: z.array(z.enum(GOAL_VALUES)),
  maxLearners: z.coerce.number().int().min(1, "At least 1 learner").max(40, "At most 40 learners"),
  languages: z.array(z.string().trim().min(1).max(30, "Keep each language under 30 characters")).max(8, "Up to 8 languages"),
  funFact: z.string().trim().max(200, "Keep the fun fact under 200 characters").default(""),
});

/** Everything on the profile a tutor can edit, besides bio and video. */
export type ProfileDetails = z.infer<typeof detailsSchema>;

type TutorRow = typeof tutors.$inferSelect;

/** The same fields in the same order, so two versions can be compared as text. */
export function normalizeDetails(details: ProfileDetails): ProfileDetails {
  return {
    subjects: details.subjects,
    levels: details.levels,
    schoolYear: details.schoolYear,
    teachingStyles: details.teachingStyles,
    goalFocus: details.goalFocus,
    maxLearners: details.maxLearners,
    languages: details.languages,
    funFact: details.funFact,
  };
}

/** A fingerprint of one version of the details, used to spot changes. */
export function detailsFingerprint(details: ProfileDetails): string {
  return JSON.stringify(normalizeDetails(details));
}

export function liveDetailsOf(tutor: TutorRow): ProfileDetails {
  return normalizeDetails({
    subjects: tutor.subjects,
    levels: tutor.levels,
    schoolYear: tutor.schoolYear ?? "",
    teachingStyles: tutor.teachingStyles as ProfileDetails["teachingStyles"],
    goalFocus: tutor.goalFocus as ProfileDetails["goalFocus"],
    maxLearners: tutor.maxLearners,
    languages: tutor.languages,
    funFact: tutor.funFact ?? "",
  });
}

/** The tutor's pending details, or null if nothing (valid) is waiting. */
export function pendingDetailsOf(tutor: TutorRow): ProfileDetails | null {
  if (tutor.profileDraft === null) return null;
  const parsed = detailsSchema.safeParse(tutor.profileDraft);
  return parsed.success ? normalizeDetails(parsed.data) : null;
}
