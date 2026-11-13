/**
 * The TutorMe database: the 14 core tables from mvp-spec.md ("Data model").
 *
 * Drizzle reads this file to generate SQL migrations (`npm run db:generate`).
 * Row-level security (who can see which rows) is NOT defined here; it lives in
 * a hand-written SQL migration in db/migrations, so the rules are easy to read
 * in one place.
 *
 * Money is stored in cents (integers) to avoid rounding errors.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Enums (fixed lists of allowed values)
// ---------------------------------------------------------------------------

export const profileRole = pgEnum("profile_role", ["client", "tutor", "admin"]);

export const inviteKind = pgEnum("invite_kind", ["tutor", "parent", "learner"]);
export const inviteStatus = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const tutorStatus = pgEnum("tutor_status", [
  "invited",
  "active",
  "offboarding",
  "inactive",
]);

export const enrollmentTier = pgEnum("enrollment_tier", ["standard", "premium"]);
export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "paused",
  "ended",
]);

export const sessionStatus = pgEnum("session_status", [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

/** School stages plus test prep (chosen Nov 13, 2026). */
export const studyLevel = pgEnum("study_level", [
  "elementary",
  "middle_school",
  "high_school",
  "ap",
  "sat_act",
  "college",
]);

/**
 * A match request's life (mvp-spec.md, "Matching"):
 *   suggested → requested (family picks) → accepted (tutor, within 48h) → approved (admin)
 * Ways it ends early:
 *   skipped   — the family asked for someone else
 *   declined  — the tutor (or admin) said no, or the trial wasn't a fit
 *   expired   — the tutor didn't answer within 48 hours
 *   cancelled — admin matched the learner by hand instead
 */
export const matchStatus = pgEnum("match_status", [
  "suggested",
  "requested",
  "accepted",
  "approved",
  "declined",
  "expired",
  "skipped",
  "cancelled",
]);

// ---------------------------------------------------------------------------
// People and accounts
// ---------------------------------------------------------------------------

/**
 * One row per person who can log in.
 * `id` is the same uuid as the Neon Auth user (neon_auth."user".id).
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  role: profileRole("role").notNull().default("client"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});

/** The paying side: a parent, or a learner who is 18+. */
export const accounts = pgTable("accounts", {
  id: id(),
  ownerId: uuid("owner_id")
    .notNull()
    .unique()
    .references(() => profiles.id),
  stripeCustomerId: text("stripe_customer_id").unique(),
  createdAt: createdAt(),
});

/**
 * The student being tutored. Each learner belongs to at most one account.
 * `profileId` is empty when the learner has no login of their own.
 * `accountId` is empty only for a minor who signed up before a parent linked;
 * they can't book until it is set.
 */
export const learners = pgTable(
  "learners",
  {
    id: id(),
    accountId: uuid("account_id").references(() => accounts.id),
    profileId: uuid("profile_id")
      .unique()
      .references(() => profiles.id),
    name: text("name").notNull(),
    grade: text("grade"),
    isMinor: boolean("is_minor").notNull(),
    goals: text("goals"),
    baseline: text("baseline"),
    subjects: text("subjects").array().notNull().default([]),
    /**
     * What the family asked for when finding a tutor: weekly availability,
     * teaching style, main goal, tutor gender, free-text notes.
     * Shape: LearnerPreferences in lib/matching.ts.
     */
    preferences: jsonb("preferences").notNull().default({}),
    // Parental consent, recorded when a parent accepts the link to a minor.
    consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
    consentGivenBy: uuid("consent_given_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (table) => [index("learners_account_idx").on(table.accountId)],
);

/**
 * Email invites with a one-time code. Used to invite tutors, to ask a parent
 * to link to a minor learner, and to give a learner their own login.
 * The other side must accept; no one can attach themselves by name.
 */
export const invites = pgTable(
  "invites",
  {
    id: id(),
    kind: inviteKind("kind").notNull(),
    email: text("email").notNull(),
    code: text("code").notNull().unique(),
    accountId: uuid("account_id").references(() => accounts.id),
    learnerId: uuid("learner_id").references(() => learners.id),
    // For tutor invites: the tutor row (status "invited") this invite activates.
    tutorId: uuid("tutor_id").references(() => tutors.id),
    createdBy: uuid("created_by").references(() => profiles.id),
    status: inviteStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("invites_email_idx").on(table.email)],
);

// ---------------------------------------------------------------------------
// Tutors
// ---------------------------------------------------------------------------

/**
 * A contract tutor. Admin creates the row when sending the invite
 * (status "invited", no login yet); accepting the invite fills `profileId`
 * and sets status "active". The invited email lives on the invite, not here,
 * because matched families can read parts of this row.
 */
export const tutors = pgTable("tutors", {
  id: id(),
  profileId: uuid("profile_id")
    .unique()
    .references(() => profiles.id),
  status: tutorStatus("status").notNull().default("invited"),
  subjects: text("subjects").array().notNull().default([]),
  stripeAccountId: text("stripe_account_id").unique(),
  zoomUserId: text("zoom_user_id"),
  termStart: date("term_start"),
  termEnd: date("term_end"),
  // The tutor's share of each session, as a percent. 75 means 75%.
  splitPct: numeric("split_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("75"),

  // ----- Public profile, shown to families on suggestion cards -----
  levels: studyLevel("levels").array().notNull().default([]),
  schoolYear: text("school_year"), // e.g. "Columbia, junior"
  bio: text("bio"), // approved by admin
  introVideoUrl: text("intro_video_url"), // approved by admin
  // The tutor's latest edits, waiting for admin approval (contact-info check).
  bioDraft: text("bio_draft"),
  introVideoUrlDraft: text("intro_video_url_draft"),

  // ----- Private, used only for matching -----
  maxLearners: integer("max_learners").notNull().default(5),
  birthDate: date("birth_date"), // tutors under 18 stay out of matching
  gender: text("gender"), // "female", "male", or null
  teachingStyles: text("teaching_styles").array().notNull().default([]),
  goalFocus: text("goal_focus").array().notNull().default([]),

  createdAt: createdAt(),
});

/** Weekly open hours. weekday: 0 = Sunday … 6 = Saturday. Times are Eastern. */
export const availability = pgTable(
  "availability",
  {
    id: id(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id),
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [index("availability_tutor_idx").on(table.tutorId)],
);

// ---------------------------------------------------------------------------
// Matching and sessions
// ---------------------------------------------------------------------------

/** A learner matched with a tutor for one subject (set by admin). */
export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id),
    subject: text("subject").notNull(),
    tier: enrollmentTier("tier").notNull().default("standard"),
    rateCents: integer("rate_cents").notNull(), // hourly price, e.g. 6000 = $60
    status: enrollmentStatus("status").notNull().default("active"),
    // True from admin approval until the family says the trial was a good fit.
    // While true, only one (trial) session can be booked.
    inTrial: boolean("in_trial").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    index("enrollments_learner_idx").on(table.learnerId),
    index("enrollments_tutor_idx").on(table.tutorId),
    // One tutor per subject per learner (spec): at most one ACTIVE match
    // for the same learner and subject, whatever the capitalisation.
    uniqueIndex("enrollments_one_active_per_subject")
      .on(table.learnerId, sql`lower(${table.subject})`)
      .where(sql`status = 'active'`),
  ],
);

/**
 * One suggested tutor for one learner and subject, and how it went
 * (mvp-spec.md, "Matching"). Families see up to three suggestions at a time;
 * picking one makes it "requested" with a 48-hour deadline for the tutor.
 * Written only by trusted server code (lib/matching.ts).
 */
export const matchRequests = pgTable(
  "match_requests",
  {
    id: id(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id),
    subject: text("subject").notNull(),
    level: studyLevel("level").notNull(),
    score: integer("score").notNull(), // higher is a better fit
    rank: smallint("rank").notNull(), // 1 = recommended, 2–3 = alternates
    status: matchStatus("status").notNull().default("suggested"),
    requestedBy: uuid("requested_by").references(() => profiles.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // set when requested
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id), // set when approved
    createdAt: createdAt(),
  },
  (table) => [
    index("match_requests_learner_idx").on(table.learnerId),
    index("match_requests_tutor_idx").on(table.tutorId),
    // At most one live request per learner and subject.
    uniqueIndex("match_requests_one_live_per_subject")
      .on(table.learnerId, sql`lower(${table.subject})`)
      .where(sql`status in ('requested', 'accepted')`),
  ],
);

/**
 * One booked lesson. `taughtBy` is kept separate from the enrollment's tutor
 * so a takeover pays whoever actually teaches.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    taughtBy: uuid("taught_by")
      .notNull()
      .references(() => tutors.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: sessionStatus("status").notNull().default("scheduled"),
    zoomMeetingId: text("zoom_meeting_id"),
    zoomJoinUrl: text("zoom_join_url"),
    priceCents: integer("price_cents").notNull(),
    // Who booked it, and which weekly series it belongs to (null for one-offs).
    bookedBy: uuid("booked_by").references(() => profiles.id),
    seriesId: uuid("series_id"),
    // Cancellation. `cancelledLate` means the family cancelled with under
    // 24 hours' notice, so it's charged like a completed session.
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => profiles.id),
    cancelledLate: boolean("cancelled_late").notNull().default(false),
    // The first session with a newly matched tutor (normal price).
    isTrial: boolean("is_trial").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    index("sessions_series_idx").on(table.seriesId),
    index("sessions_enrollment_idx").on(table.enrollmentId),
    index("sessions_taught_by_idx").on(table.taughtBy),
    index("sessions_starts_at_idx").on(table.startsAt),
  ],
);

export const sessionNotes = pgTable("session_notes", {
  sessionId: uuid("session_id")
    .primaryKey()
    .references(() => sessions.id),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id),
  notes: text("notes"),
  transcriptRef: text("transcript_ref"),
  agendaJson: jsonb("agenda_json"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const progressEntries = pgTable(
  "progress_entries",
  {
    id: id(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id),
    metric: text("metric").notNull(),
    value: numeric("value").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("progress_learner_idx").on(table.learnerId)],
);

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

/**
 * A conversation. `learnerId` is set for learner ↔ tutor threads (so a
 * minor's account holder can read them) and empty for threads with TutorMe.
 */
export const threads = pgTable("threads", {
  id: id(),
  learnerId: uuid("learner_id").references(() => learners.id),
  participantIds: uuid("participant_ids").array().notNull(),
  createdAt: createdAt(),
});

export const messages = pgTable(
  "messages",
  {
    id: id(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id),
    body: text("body").notNull(),
    // Set by the contact filter (phone numbers, emails, social handles).
    flagged: boolean("flagged").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("messages_thread_idx").on(table.threadId, table.createdAt)],
);

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export const payments = pgTable("payments", {
  id: id(),
  sessionId: uuid("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  amountCents: integer("amount_cents").notNull(),
  feeCents: integer("fee_cents").notNull(), // TutorMe's platform fee
  status: paymentStatus("status").notNull().default("pending"),
  createdAt: createdAt(),
});

/** One weekly payout per tutor. `periodStart` is the Monday of that week. */
export const payouts = pgTable(
  "payouts",
  {
    id: id(),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => tutors.id),
    periodStart: date("period_start").notNull(),
    amountCents: integer("amount_cents").notNull(),
    stripeTransferId: text("stripe_transfer_id").unique(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("payouts_tutor_period_idx").on(table.tutorId, table.periodStart),
  ],
);
