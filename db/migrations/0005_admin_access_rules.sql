-- =============================================================================
-- Admin slice: tighter tutor columns and date-aware tutor access.
-- =============================================================================

-- 1. Families matched with a tutor can read that tutor's row. Until now that
--    included pay (split_pct) and payment/Zoom ids. From here on, app_user
--    only sees the public columns. Pay and account ids are read by trusted
--    server code (as the owner) when needed.
REVOKE SELECT ON tutors FROM app_user;
--> statement-breakpoint
GRANT SELECT (id, profile_id, status, subjects, term_start, term_end, created_at) ON tutors TO app_user;
--> statement-breakpoint

-- 2. A tutor can work with learners only while active, or during offboarding,
--    and never more than 7 days after their contract's term_end. This holds
--    even before the scheduled job that moves tutors to "offboarding" and
--    "inactive" exists, so an ended contract can't keep access by accident.
CREATE OR REPLACE FUNCTION app.my_working_tutor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM tutors
  WHERE profile_id = app.current_profile_id()
    AND status IN ('active', 'offboarding')
    AND (term_end IS NULL OR current_date <= term_end + 7)
$$;
