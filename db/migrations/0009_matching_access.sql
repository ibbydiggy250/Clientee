-- =============================================================================
-- Matching: who can read what.
--
-- match_requests is read and written only by trusted server code
-- (lib/matching.ts), which checks permissions itself. So: row-level security
-- on, and no grants at all to app_user. Nobody reaches it through withUser.
--
-- The new public tutor profile columns may be read by families who can
-- already see that tutor. Private matching columns (birth date, gender,
-- styles, drafts, learner cap) are left out on purpose.
-- =============================================================================

ALTER TABLE match_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

GRANT SELECT (levels, school_year, bio, intro_video_url) ON tutors TO app_user;
