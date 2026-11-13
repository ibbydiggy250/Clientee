/**
 * Rule-based matching (mvp-spec.md, "Matching"), with the choices the user
 * made on Nov 13, 2026.
 *
 *   1. The family fills in what they need (subject, level, availability,
 *      preferences). The system suggests one tutor plus up to 2 alternates.
 *   2. The family requests one, or asks for someone else.
 *   3. The tutor has 48 hours to accept. Declined or expired → new suggestions.
 *   4. Admin approves. That creates the enrollment, in trial.
 *   5. After the trial: "good fit" → weekly sessions; "not a fit" → new suggestions.
 *
 * Part 1 below is pure (no database) so the scoring rules can be tested.
 * Part 2 reads and writes as the database owner and checks permissions itself.
 * Each step is one conditional update, so double clicks and races can't
 * skip a step. Every function that depends on time takes `now`.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  availability,
  enrollments,
  learners,
  matchRequests,
  profiles,
  sessions,
  tutors,
} from "@/db/schema";
import type { SignedInUser } from "@/lib/auth/current-user";
import { isFamilyOf } from "@/lib/booking";
import { orm } from "@/lib/db";
import { hasPostgresCode } from "@/lib/db-errors";
import { levelLabel, MAIN_GOALS, TEACHING_STYLES, type Level } from "@/lib/matching-options";
import { publicTutorName } from "@/lib/public-name";

// The lists families and tutors pick from live in lib/matching-options.ts
// (browser-safe). Re-exported here for server code's convenience.
export { LEVELS, MAIN_GOALS, TEACHING_STYLES, levelLabel, type Level } from "@/lib/matching-options";

// ---------------------------------------------------------------------------
// Rules and weights (the spec's "Scoring" table)
// ---------------------------------------------------------------------------

/** How long a tutor has to accept a request. */
export const REQUEST_HOURS = 48;
/** One recommended tutor plus up to two alternates. */
export const SUGGESTION_COUNT = 3;
/** Tutors under this age stay out of matching. */
export const MIN_TUTOR_AGE = 18;

export const WEIGHTS = {
  // Fit with the family's preferences: the main score.
  teachingStyle: 25,
  mainGoal: 25,
  tutorGender: 10,
  // Open capacity: up to this many points for a tutor with all slots free.
  openCapacity: 15,
  // New tutors get a boost for their first few matches.
  newTutor: 10,
  // Recently matched tutors drop a little, so matches rotate.
  recentlyMatched: -15,
} as const;
export const NEW_TUTOR_MATCHES = 3;
export const RECENTLY_MATCHED_DAYS = 7;
// Ratings and the trial-to-weekly rate are in the spec too, but there is no
// data for them yet (ratings are v1). They score 0 until there is.

/** Usual hourly rates: AP and SAT/ACT are premium (spec: ~$60 vs $80+). */
export function usualRate(level: Level): { tier: "standard" | "premium"; rateCents: number } {
  return level === "ap" || level === "sat_act"
    ? { tier: "premium", rateCents: 8000 }
    : { tier: "standard", rateCents: 6000 };
}

// ---------------------------------------------------------------------------
// What the family tells us
// ---------------------------------------------------------------------------

const clock = z.string().regex(/^\d{2}:\d{2}$/);

export const preferencesSchema = z.object({
  availability: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), startTime: clock, endTime: clock }))
    .min(1, "Add at least one time that works each week"),
  teachingStyle: z.enum(["patient", "structured", "challenging", "any"]).default("any"),
  mainGoal: z.enum(["homework", "catch_up", "get_ahead", "test_prep"]).optional(),
  tutorGender: z.enum(["female", "male", "any"]).default("any"),
  // Free text: seen by admin, and by the tutor only after admin approves the match.
  notes: z.string().trim().max(1000).default(""),
});
export type LearnerPreferences = z.infer<typeof preferencesSchema>;

export const searchSchema = z.object({
  subject: z.string().trim().min(1, "Which subject?").max(80),
  level: z.enum(["elementary", "middle_school", "high_school", "ap", "sat_act", "college"]),
  preferences: preferencesSchema,
});
export type TutorSearch = z.infer<typeof searchSchema>;

// ---------------------------------------------------------------------------
// Part 1 — scoring (pure)
// ---------------------------------------------------------------------------

export type WeeklyWindow = { weekday: number; startTime: string; endTime: string };

export type Candidate = {
  id: string;
  status: string;
  subjects: string[];
  levels: string[];
  birthDate: string | null;
  gender: string | null;
  teachingStyles: string[];
  goalFocus: string[];
  maxLearners: number;
  activeLearners: number;
  totalMatches: number;
  lastMatchedAt: Date | null;
  windows: WeeklyWindow[];
};

function minutesOf(clockTime: string): number {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return hours * 60 + minutes;
}

/** True if the two sets of weekly windows share at least one full hour. */
export function sharesAnHour(family: WeeklyWindow[], tutor: WeeklyWindow[]): boolean {
  return family.some((a) =>
    tutor.some((b) => {
      if (a.weekday !== b.weekday) return false;
      const start = Math.max(minutesOf(a.startTime), minutesOf(b.startTime));
      const end = Math.min(minutesOf(a.endTime), minutesOf(b.endTime));
      return end - start >= 60;
    }),
  );
}

function ageOn(birthDate: string, now: Date): number {
  const born = new Date(`${birthDate}T12:00:00Z`);
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const birthdayPassed =
    now.getUTCMonth() > born.getUTCMonth() ||
    (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() >= born.getUTCDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

function teachesSubject(candidate: Candidate, subject: string): boolean {
  const wanted = subject.trim().toLowerCase();
  return candidate.subjects.some((taught) => taught.trim().toLowerCase() === wanted);
}

/** The hard filters. Returns why this tutor can't be suggested, or null if they can. */
export function whyNotEligible(candidate: Candidate, search: TutorSearch, now: Date): string | null {
  if (candidate.status !== "active") return "not active";
  if (!teachesSubject(candidate, search.subject)) return "doesn't teach the subject";
  if (!candidate.levels.includes(search.level)) return "doesn't teach the level";
  if (!candidate.birthDate) return "birth date not on file";
  if (ageOn(candidate.birthDate, now) < MIN_TUTOR_AGE) return "under 18";
  if (candidate.activeLearners >= candidate.maxLearners) return "at their learner cap";
  if (!sharesAnHour(search.preferences.availability, candidate.windows)) return "no shared hour";
  return null;
}

/** The ranking score for an eligible tutor. Higher is better. */
export function scoreCandidate(candidate: Candidate, search: TutorSearch, now: Date): number {
  const preferences = search.preferences;
  let score = 0;

  // Fit with the family's preferences ("no preference" counts as a match).
  if (preferences.teachingStyle === "any" || candidate.teachingStyles.includes(preferences.teachingStyle)) {
    score += WEIGHTS.teachingStyle;
  }
  if (!preferences.mainGoal || candidate.goalFocus.includes(preferences.mainGoal)) {
    score += WEIGHTS.mainGoal;
  }
  if (preferences.tutorGender === "any" || candidate.gender === preferences.tutorGender) {
    score += WEIGHTS.tutorGender;
  }

  // Open capacity, in proportion to free slots.
  const freeShare = (candidate.maxLearners - candidate.activeLearners) / Math.max(candidate.maxLearners, 1);
  score += Math.round(WEIGHTS.openCapacity * Math.max(0, freeShare));

  if (candidate.totalMatches < NEW_TUTOR_MATCHES) score += WEIGHTS.newTutor;

  const recentCutoff = now.getTime() - RECENTLY_MATCHED_DAYS * 86_400_000;
  if (candidate.lastMatchedAt && candidate.lastMatchedAt.getTime() > recentCutoff) {
    score += WEIGHTS.recentlyMatched;
  }

  return score;
}

/**
 * Eligible tutors, best first. Ties go to the tutor with fewer learners,
 * then by id, so the order never depends on database row order.
 */
export function rankCandidates(
  candidates: Candidate[],
  search: TutorSearch,
  now: Date,
  excludeTutorIds: Set<string> = new Set(),
): { tutorId: string; score: number }[] {
  return candidates
    .filter((candidate) => !excludeTutorIds.has(candidate.id) && whyNotEligible(candidate, search, now) === null)
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, search, now) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.activeLearners - b.candidate.activeLearners ||
        a.candidate.id.localeCompare(b.candidate.id),
    )
    .map(({ candidate, score }) => ({ tutorId: candidate.id, score }));
}

// ---------------------------------------------------------------------------
// Part 2 — the database steps
// ---------------------------------------------------------------------------

/** A problem the person can fix; its message is safe to show. */
export class MatchingError extends Error {}

/** Everything scoring needs about every tutor. */
async function loadCandidates(): Promise<Candidate[]> {
  const rows = await orm.select().from(tutors);
  if (rows.length === 0) return [];
  const tutorIds = rows.map((row) => row.id);

  const windows = await orm
    .select({ tutorId: availability.tutorId, weekday: availability.weekday, startTime: availability.startTime, endTime: availability.endTime })
    .from(availability)
    .where(inArray(availability.tutorId, tutorIds));

  const matchStats = await orm
    .select({
      tutorId: enrollments.tutorId,
      active: sql<number>`count(*) filter (where ${enrollments.status} = 'active')::int`,
      total: sql<number>`count(*)::int`,
      latest: sql<Date | null>`max(${enrollments.createdAt})`,
    })
    .from(enrollments)
    .where(inArray(enrollments.tutorId, tutorIds))
    .groupBy(enrollments.tutorId);

  return rows.map((tutor) => {
    const stats = matchStats.find((stat) => stat.tutorId === tutor.id);
    return {
      id: tutor.id,
      status: tutor.status,
      subjects: tutor.subjects,
      levels: tutor.levels,
      birthDate: tutor.birthDate,
      gender: tutor.gender,
      teachingStyles: tutor.teachingStyles,
      goalFocus: tutor.goalFocus,
      maxLearners: tutor.maxLearners,
      activeLearners: stats?.active ?? 0,
      totalMatches: stats?.total ?? 0,
      lastMatchedAt: stats?.latest ? new Date(stats.latest) : null,
      windows: windows.filter((window) => window.tutorId === tutor.id),
    };
  });
}

/** Tutors this learner shouldn't be shown again for this subject. */
async function alreadyTriedTutors(learnerId: string, subject: string): Promise<Set<string>> {
  const tried = await orm
    .select({ tutorId: matchRequests.tutorId })
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.learnerId, learnerId),
        sql`lower(${matchRequests.subject}) = lower(${subject})`,
        inArray(matchRequests.status, ["skipped", "declined", "expired"]),
      ),
    );
  // Any past or current enrollment for this subject (e.g. a trial that wasn't a fit).
  const enrolled = await orm
    .select({ tutorId: enrollments.tutorId })
    .from(enrollments)
    .where(and(eq(enrollments.learnerId, learnerId), sql`lower(${enrollments.subject}) = lower(${subject})`));
  return new Set([...tried, ...enrolled].map((row) => row.tutorId));
}

/** Requests whose tutor didn't answer in time become "expired". Run before reading. */
export async function expireOverdueRequests(now: Date): Promise<void> {
  await orm
    .update(matchRequests)
    .set({ status: "expired", decidedAt: now })
    .where(and(eq(matchRequests.status, "requested"), sql`${matchRequests.expiresAt} <= ${now}`));
}

async function assertFamilyOfLinkedLearner(user: SignedInUser, learnerId: string) {
  if (!(await isFamilyOf(user, learnerId))) throw new MatchingError("Only the learner or their account holder can do that.");
  const [learner] = await orm.select().from(learners).where(eq(learners.id, learnerId));
  if (!learner) throw new MatchingError("That learner no longer exists.");
  if (!learner.accountId) throw new MatchingError("A parent has to link up before we can find a tutor.");
  return learner;
}

/** Writes fresh suggestions for a search, replacing any untouched ones. Returns how many. */
async function writeSuggestions(learnerId: string, search: TutorSearch, now: Date): Promise<number> {
  const ranked = rankCandidates(await loadCandidates(), search, now, await alreadyTriedTutors(learnerId, search.subject));
  const top = ranked.slice(0, SUGGESTION_COUNT);

  await orm.transaction(async (tx) => {
    // Untouched suggestions from an earlier search are replaced, not kept.
    await tx
      .delete(matchRequests)
      .where(
        and(
          eq(matchRequests.learnerId, learnerId),
          sql`lower(${matchRequests.subject}) = lower(${search.subject})`,
          eq(matchRequests.status, "suggested"),
        ),
      );
    if (top.length > 0) {
      await tx.insert(matchRequests).values(
        top.map((pick, index) => ({
          learnerId,
          tutorId: pick.tutorId,
          subject: search.subject,
          level: search.level,
          score: pick.score,
          rank: index + 1,
        })),
      );
    }
  });

  // Nobody fit: note it on the learner, so admin's intake shows it for a hand match.
  await recordUnmetSearch(learnerId, top.length === 0 ? { subject: search.subject, level: search.level } : null, now);
  return top.length;
}

/**
 * Saves (or clears) "searched for X, nobody fit" on the learner, inside their
 * preferences. Admin's intake lists these learners for a hand match.
 */
async function recordUnmetSearch(learnerId: string, unmet: { subject: string; level: string } | null, now: Date) {
  const updated = unmet
    ? sql`${learners.preferences} || ${JSON.stringify({ unmetSearch: { ...unmet, at: now.toISOString() } })}::jsonb`
    : sql`${learners.preferences} - 'unmetSearch'`;
  await orm.update(learners).set({ preferences: updated }).where(eq(learners.id, learnerId));
}

export type UnmetSearch = { subject: string; level: string; at: string };

/** Reads "searched for X, nobody fit" out of a learner's saved preferences. */
export function readUnmetSearch(preferences: unknown): UnmetSearch | null {
  const unmet = (preferences as { unmetSearch?: UnmetSearch } | null)?.unmetSearch;
  return unmet?.subject ? unmet : null;
}

/** Clears an unmet search once admin has matched that subject by hand. */
export async function clearUnmetSearch(learnerId: string, subject: string): Promise<void> {
  await orm
    .update(learners)
    .set({ preferences: sql`${learners.preferences} - 'unmetSearch'` })
    .where(and(eq(learners.id, learnerId), sql`lower(${learners.preferences} -> 'unmetSearch' ->> 'subject') = lower(${subject})`));
}

/** A learner already matched for a subject can't ask for a second tutor in it. */
async function assertNoActiveTutorFor(learner: { id: string; name: string }, subject: string) {
  const [active] = await orm
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.learnerId, learner.id),
        eq(enrollments.status, "active"),
        sql`lower(${enrollments.subject}) = lower(${subject})`,
      ),
    );
  if (active) throw new MatchingError(`${learner.name} already has a ${subject} tutor.`);
}

/** Admin-only steps check the role themselves, like lib/admin.ts does. */
async function assertAdminActor(actor: SignedInUser) {
  const [profile] = await orm.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, actor.id));
  if (profile?.role !== "admin") throw new MatchingError("Only TutorMe staff can do that.");
}

async function hasLiveRequest(learnerId: string, subject: string): Promise<boolean> {
  const [live] = await orm
    .select({ id: matchRequests.id })
    .from(matchRequests)
    .where(
      and(
        eq(matchRequests.learnerId, learnerId),
        sql`lower(${matchRequests.subject}) = lower(${subject})`,
        inArray(matchRequests.status, ["requested", "accepted"]),
      ),
    );
  return Boolean(live);
}

/** Step 1: the family says what they need; we save it and suggest tutors. */
export async function findTutors(user: SignedInUser, learnerId: string, search: TutorSearch, now: Date): Promise<number> {
  const learner = await assertFamilyOfLinkedLearner(user, learnerId);
  await assertNoActiveTutorFor(learner, search.subject);
  await expireOverdueRequests(now);
  if (await hasLiveRequest(learnerId, search.subject)) {
    throw new MatchingError(`${learner.name} already has a ${search.subject} request waiting.`);
  }

  // Remember the answers so the form is pre-filled next time.
  const subjects = learner.subjects.some((subject) => subject.toLowerCase() === search.subject.toLowerCase())
    ? learner.subjects
    : [...learner.subjects, search.subject];
  await orm.update(learners).set({ preferences: search.preferences, subjects }).where(eq(learners.id, learnerId));

  return writeSuggestions(learnerId, search, now);
}

/** The family wants someone else: today's suggestions are set aside and new ones found. */
export async function askForAnother(user: SignedInUser, learnerId: string, subject: string, now: Date): Promise<number> {
  const learner = await assertFamilyOfLinkedLearner(user, learnerId);
  await assertNoActiveTutorFor(learner, subject);
  const shown = await orm
    .update(matchRequests)
    .set({ status: "skipped", decidedAt: now })
    .where(
      and(
        eq(matchRequests.learnerId, learnerId),
        sql`lower(${matchRequests.subject}) = lower(${subject})`,
        eq(matchRequests.status, "suggested"),
      ),
    )
    .returning({ level: matchRequests.level });
  const level = shown[0]?.level;
  if (!level) throw new MatchingError("There are no suggestions to swap. Start a new search.");

  const preferences = preferencesSchema.parse(learner.preferences);
  return writeSuggestions(learnerId, { subject, level, preferences }, now);
}

/** Re-checks the hard filters for one tutor right now. */
async function assertStillEligible(tutorId: string, search: TutorSearch, now: Date) {
  const candidate = (await loadCandidates()).find((tutor) => tutor.id === tutorId);
  const reason = candidate ? whyNotEligible(candidate, search, now) : "gone";
  if (reason) throw new MatchingError("That tutor can't take new learners right now. Ask for another suggestion.");
}

async function searchFromRequest(request: typeof matchRequests.$inferSelect): Promise<TutorSearch> {
  const [learner] = await orm.select({ preferences: learners.preferences }).from(learners).where(eq(learners.id, request.learnerId));
  return { subject: request.subject, level: request.level, preferences: preferencesSchema.parse(learner?.preferences ?? {}) };
}

/** Step 2: the family requests one suggested tutor. The tutor has 48 hours. */
export async function requestTutor(user: SignedInUser, requestId: string, now: Date): Promise<void> {
  const [request] = await orm.select().from(matchRequests).where(eq(matchRequests.id, requestId));
  if (!request) throw new MatchingError("That suggestion is gone. Start a new search.");
  const learner = await assertFamilyOfLinkedLearner(user, request.learnerId);
  await assertNoActiveTutorFor(learner, request.subject);
  await assertStillEligible(request.tutorId, await searchFromRequest(request), now);

  try {
    await orm.transaction(async (tx) => {
      const [requested] = await tx
        .update(matchRequests)
        .set({ status: "requested", requestedBy: user.id, expiresAt: new Date(now.getTime() + REQUEST_HOURS * 3_600_000) })
        .where(and(eq(matchRequests.id, requestId), eq(matchRequests.status, "suggested")))
        .returning({ id: matchRequests.id });
      if (!requested) throw new MatchingError("That suggestion was already used. Refresh the page.");

      // The alternates weren't chosen; clear them (they'll be re-suggested if needed).
      await tx
        .delete(matchRequests)
        .where(
          and(
            eq(matchRequests.learnerId, request.learnerId),
            sql`lower(${matchRequests.subject}) = lower(${request.subject})`,
            eq(matchRequests.status, "suggested"),
          ),
        );
    });
  } catch (problem) {
    if (hasPostgresCode(problem, "23505")) throw new MatchingError("There's already a request waiting for this subject.");
    throw problem;
  }
}

/** Step 3: the tutor accepts (within 48 hours) or declines. */
export async function respondToRequest(user: SignedInUser, requestId: string, decision: "accept" | "decline", now: Date): Promise<void> {
  await expireOverdueRequests(now);
  const [row] = await orm
    .select({ request: matchRequests, tutorProfileId: tutors.profileId })
    .from(matchRequests)
    .innerJoin(tutors, eq(tutors.id, matchRequests.tutorId))
    .where(eq(matchRequests.id, requestId));
  if (!row || row.tutorProfileId !== user.id) throw new MatchingError("That request isn't yours.");

  if (decision === "accept") await assertStillEligible(row.request.tutorId, await searchFromRequest(row.request), now);

  const [updated] = await orm
    .update(matchRequests)
    .set({ status: decision === "accept" ? "accepted" : "declined", decidedAt: now })
    .where(
      and(
        eq(matchRequests.id, requestId),
        eq(matchRequests.status, "requested"),
        sql`${matchRequests.expiresAt} > ${now}`,
      ),
    )
    .returning({ id: matchRequests.id });
  if (!updated) throw new MatchingError("This request has already been answered or has expired.");
}

/** Step 4 (admin): approve an accepted request. Creates the enrollment, in trial. */
export async function approveRequest(actor: SignedInUser, requestId: string, now: Date): Promise<void> {
  await assertAdminActor(actor);
  const [request] = await orm.select().from(matchRequests).where(eq(matchRequests.id, requestId));
  if (!request || request.status !== "accepted") throw new MatchingError("Only accepted requests can be approved.");
  await assertStillEligible(request.tutorId, await searchFromRequest(request), now);

  const { tier, rateCents } = usualRate(request.level);
  try {
    await orm.transaction(async (tx) => {
      const [enrollment] = await tx
        .insert(enrollments)
        .values({ learnerId: request.learnerId, tutorId: request.tutorId, subject: request.subject, tier, rateCents, inTrial: true })
        .returning({ id: enrollments.id });
      const [approved] = await tx
        .update(matchRequests)
        .set({ status: "approved", decidedAt: now, enrollmentId: enrollment.id })
        .where(and(eq(matchRequests.id, requestId), eq(matchRequests.status, "accepted")))
        .returning({ id: matchRequests.id });
      if (!approved) throw new MatchingError("This request was already handled.");
    });
  } catch (problem) {
    if (hasPostgresCode(problem, "23505")) throw new MatchingError("This learner already has an active tutor for that subject.");
    throw problem;
  }
}

/** Admin turns down a request that's waiting on the tutor or on approval. */
export async function rejectRequest(actor: SignedInUser, requestId: string, now: Date): Promise<void> {
  await assertAdminActor(actor);
  const [updated] = await orm
    .update(matchRequests)
    .set({ status: "declined", decidedAt: now })
    .where(and(eq(matchRequests.id, requestId), inArray(matchRequests.status, ["requested", "accepted"])))
    .returning({ id: matchRequests.id });
  if (!updated) throw new MatchingError("This request was already handled.");
}

/** When admin matches by hand, any open requests for that subject are closed. */
export async function closeOpenRequests(learnerId: string, subject: string, now: Date): Promise<void> {
  await orm
    .update(matchRequests)
    .set({ status: "cancelled", decidedAt: now })
    .where(
      and(
        eq(matchRequests.learnerId, learnerId),
        sql`lower(${matchRequests.subject}) = lower(${subject})`,
        inArray(matchRequests.status, ["suggested", "requested", "accepted"]),
      ),
    );
}

/**
 * Step 5: after the trial session, the family says how it went.
 * Good fit → weekly booking opens. Not a fit → the match ends, any other
 * booked sessions with that tutor are cancelled (not charged), and the
 * family can look for the next tutor.
 */
export async function recordTrialResult(user: SignedInUser, enrollmentId: string, goodFit: boolean, now: Date): Promise<void> {
  const [enrollment] = await orm.select().from(enrollments).where(eq(enrollments.id, enrollmentId));
  if (!enrollment) throw new MatchingError("That match no longer exists.");
  await assertFamilyOfLinkedLearner(user, enrollment.learnerId);
  if (!enrollment.inTrial || enrollment.status !== "active") throw new MatchingError("This match isn't in its trial any more.");

  const [trialOver] = await orm
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.enrollmentId, enrollmentId),
        eq(sessions.isTrial, true),
        inArray(sessions.status, ["scheduled", "completed", "no_show"]),
        sql`${sessions.endsAt} <= ${now}`,
      ),
    );
  if (!trialOver) throw new MatchingError("You can say how it went once the trial session is over.");

  await orm.transaction(async (tx) => {
    if (goodFit) {
      await tx.update(enrollments).set({ inTrial: false }).where(eq(enrollments.id, enrollmentId));
      return;
    }
    await tx.update(enrollments).set({ status: "ended", inTrial: false }).where(eq(enrollments.id, enrollmentId));
    await tx
      .update(sessions)
      .set({ status: "cancelled", cancelledAt: now, cancelledBy: user.id, cancelledLate: false })
      .where(and(eq(sessions.enrollmentId, enrollmentId), eq(sessions.status, "scheduled"), sql`${sessions.startsAt} > ${now}`));
  });
}

// ---------------------------------------------------------------------------
// Reads for the screens
// ---------------------------------------------------------------------------

/** What a family sees about a tutor: the spec's public profile, nothing more. */
export type TutorCard = {
  requestId: string;
  rank: number;
  /** The subject the family searched for (not the tutor's subjects). */
  searchedSubject: string;
  name: string; // first name + last initial
  schoolYear: string | null;
  subjects: string[];
  levels: string[];
  bio: string | null;
  introVideoUrl: string | null;
};

export type MatchRequestView = {
  id: string;
  subject: string;
  level: string;
  status: (typeof matchRequests.$inferSelect)["status"];
  expiresAt: Date | null;
  decidedAt: Date | null;
  tutorName: string; // first name + last initial
};

export type LearnerMatchPage = {
  learnerName: string;
  learnerSubjects: string[];
  preferences: Partial<LearnerPreferences>;
  /** Set when the last search found nobody; TutorMe will match by hand. */
  unmetSearch: UnmetSearch | null;
  suggestions: TutorCard[];
  requests: MatchRequestView[];
  trials: { enrollmentId: string; subject: string; tutorName: string; trialBooked: boolean; trialOver: boolean }[];
};

export async function getLearnerMatchPage(user: SignedInUser, learnerId: string, now: Date): Promise<LearnerMatchPage> {
  const learner = await assertFamilyOfLinkedLearner(user, learnerId);
  await expireOverdueRequests(now);

  const rows = await orm
    .select({ request: matchRequests, tutor: tutors, fullName: profiles.name })
    .from(matchRequests)
    .innerJoin(tutors, eq(tutors.id, matchRequests.tutorId))
    .innerJoin(profiles, eq(profiles.id, tutors.profileId))
    .where(eq(matchRequests.learnerId, learnerId))
    .orderBy(matchRequests.rank);

  const suggestions: TutorCard[] = rows
    .filter((row) => row.request.status === "suggested")
    .map(({ request, tutor, fullName }) => ({
      requestId: request.id,
      rank: request.rank,
      searchedSubject: request.subject,
      name: publicTutorName(fullName),
      schoolYear: tutor.schoolYear,
      subjects: tutor.subjects,
      levels: tutor.levels.map(levelLabel),
      bio: tutor.bio,
      introVideoUrl: tutor.introVideoUrl,
    }));

  const requests: MatchRequestView[] = rows
    .filter((row) => row.request.status !== "suggested" && row.request.status !== "skipped" && row.request.status !== "cancelled")
    .map(({ request, fullName }) => ({
      id: request.id,
      subject: request.subject,
      level: levelLabel(request.level),
      status: request.status,
      expiresAt: request.expiresAt,
      decidedAt: request.decidedAt,
      tutorName: publicTutorName(fullName),
    }))
    .sort((a, b) => (b.decidedAt?.getTime() ?? Infinity) - (a.decidedAt?.getTime() ?? Infinity));

  const trialRows = await orm
    .select({ enrollment: enrollments, fullName: profiles.name })
    .from(enrollments)
    .innerJoin(tutors, eq(tutors.id, enrollments.tutorId))
    .innerJoin(profiles, eq(profiles.id, tutors.profileId))
    .where(and(eq(enrollments.learnerId, learnerId), eq(enrollments.status, "active"), eq(enrollments.inTrial, true)));

  const trials = await Promise.all(
    trialRows.map(async ({ enrollment, fullName }) => {
      const trialSessions = await orm
        .select({ endsAt: sessions.endsAt, status: sessions.status })
        .from(sessions)
        .where(and(eq(sessions.enrollmentId, enrollment.id), eq(sessions.isTrial, true), sql`${sessions.status} <> 'cancelled'`));
      return {
        enrollmentId: enrollment.id,
        subject: enrollment.subject,
        tutorName: publicTutorName(fullName),
        trialBooked: trialSessions.length > 0,
        trialOver: trialSessions.some((session) => session.endsAt <= now),
      };
    }),
  );

  return {
    learnerName: learner.name,
    learnerSubjects: learner.subjects,
    preferences: (learner.preferences ?? {}) as Partial<LearnerPreferences>,
    unmetSearch: readUnmetSearch(learner.preferences),
    suggestions,
    requests,
    trials,
  };
}

/** A tutor's waiting requests. Free-text notes stay hidden until admin approves. */
export async function getTutorRequests(user: SignedInUser, now: Date) {
  await expireOverdueRequests(now);
  const [tutor] = await orm.select({ id: tutors.id }).from(tutors).where(eq(tutors.profileId, user.id));
  if (!tutor) return [];

  const rows = await orm
    .select({ request: matchRequests, learnerName: learners.name, grade: learners.grade, preferences: learners.preferences })
    .from(matchRequests)
    .innerJoin(learners, eq(learners.id, matchRequests.learnerId))
    .where(and(eq(matchRequests.tutorId, tutor.id), eq(matchRequests.status, "requested")))
    .orderBy(matchRequests.expiresAt);

  return rows.map(({ request, learnerName, grade, preferences }) => {
    const parsed = preferencesSchema.partial().safeParse(preferences);
    const prefs = parsed.success ? parsed.data : {};
    return {
      id: request.id,
      learnerFirstName: learnerName.split(" ")[0],
      grade,
      subject: request.subject,
      level: levelLabel(request.level),
      mainGoal: MAIN_GOALS.find((goal) => goal.value === prefs.mainGoal)?.label ?? null,
      teachingStyle: TEACHING_STYLES.find((style) => style.value === prefs.teachingStyle)?.label ?? null,
      expiresAt: request.expiresAt,
    };
  });
}

/** Admin's view of open requests: waiting on the tutor, or on approval. */
export async function getOpenRequests(actor: SignedInUser, now: Date) {
  await assertAdminActor(actor);
  await expireOverdueRequests(now);
  const rows = await orm
    .select({ request: matchRequests, learnerName: learners.name, tutorName: profiles.name, preferences: learners.preferences })
    .from(matchRequests)
    .innerJoin(learners, eq(learners.id, matchRequests.learnerId))
    .innerJoin(tutors, eq(tutors.id, matchRequests.tutorId))
    .innerJoin(profiles, eq(profiles.id, tutors.profileId))
    .where(inArray(matchRequests.status, ["requested", "accepted"]))
    .orderBy(matchRequests.expiresAt);

  return rows.map(({ request, learnerName, tutorName, preferences }) => ({
    id: request.id,
    status: request.status,
    learnerName,
    tutorName,
    subject: request.subject,
    level: levelLabel(request.level),
    score: request.score,
    expiresAt: request.expiresAt,
    notes: (preferences as Partial<LearnerPreferences>)?.notes ?? "",
  }));
}
