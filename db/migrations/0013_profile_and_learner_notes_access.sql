-- =============================================================================
-- Tutor profile fields and learner notes: who can read what.
--
-- learner_notes is read and written only by trusted server code
-- (lib/learner-page.ts), which checks that the person teaches the learner.
-- So: row-level security on, and no grants at all to app_user.
--
-- The two new public profile columns (languages, fun fact) may be read by
-- families who can already see that tutor, like bio and school year.
-- profile_draft (pending edits) stays private.
-- =============================================================================

ALTER TABLE learner_notes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT (languages, fun_fact) ON tutors TO app_user;
