-- =============================================================================
-- Row-level security: who can see and change which rows.
--
-- How it works
--   * Requests made on behalf of a signed-in user run as the `app_user` role,
--     with that user's profile id stored in the `app.profile_id` setting.
--     lib/db.ts → withUser() does both at the start of each transaction.
--   * The policies below only let `app_user` touch rows that user is allowed
--     to see, as described in mvp-spec.md ("Access rules").
--   * `app_user` can only WRITE where it is clearly safe (editing your own
--     name, a tutor's availability and notes, sending a message). Everything
--     that moves money or changes access (sign-up, invites, matching, booking,
--     Stripe webhooks, payouts) runs through server code as the database
--     owner, which checks permissions itself before writing.
--   * `app_user` cannot read anyone's email. That keeps the
--     "tutors never see client contact info" rule in the database itself.
--
-- Helper functions live in the `app` schema. They are SECURITY DEFINER so they
-- can look rows up without being filtered by the very policies that call them.
-- =============================================================================

CREATE ROLE app_user NOLOGIN;
--> statement-breakpoint
GRANT app_user TO CURRENT_USER;
--> statement-breakpoint
CREATE SCHEMA app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO app_user;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Helper functions: "who am I?"
-- -----------------------------------------------------------------------------

-- The signed-in user's profile id, or NULL if none was set.
CREATE FUNCTION app.current_profile_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('app.profile_id', true), '')::uuid
$$;
--> statement-breakpoint

CREATE FUNCTION app.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = app.current_profile_id() AND role = 'admin'
  )
$$;
--> statement-breakpoint

-- My tutor id, whatever my status (used for payouts and my own tutor row).
CREATE FUNCTION app.my_tutor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM tutors WHERE profile_id = app.current_profile_id()
$$;
--> statement-breakpoint

-- My tutor id, but only while I may work with learners
-- (active, or offboarding to finish notes). NULL otherwise.
CREATE FUNCTION app.my_working_tutor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM tutors
  WHERE profile_id = app.current_profile_id()
    AND status IN ('active', 'offboarding')
$$;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Helper functions: "can I see this?"
-- -----------------------------------------------------------------------------

-- I own the account this learner belongs to.
CREATE FUNCTION app.is_account_holder_of(target_learner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM learners l
    JOIN accounts a ON a.id = l.account_id
    WHERE l.id = target_learner AND a.owner_id = app.current_profile_id()
  )
$$;
--> statement-breakpoint

-- I am this learner's account holder, or I am the learner.
CREATE FUNCTION app.is_family_of(target_learner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT app.is_account_holder_of(target_learner)
      OR EXISTS (
        SELECT 1 FROM learners
        WHERE id = target_learner AND profile_id = app.current_profile_id()
      )
$$;
--> statement-breakpoint

-- I am a working tutor with an active enrollment for this learner.
CREATE FUNCTION app.tutor_can_see_learner(target_learner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrollments
    WHERE learner_id = target_learner
      AND tutor_id = app.my_working_tutor_id()
      AND status = 'active'
  )
$$;
--> statement-breakpoint

CREATE FUNCTION app.can_see_learner(target_learner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT app.is_admin()
      OR app.is_family_of(target_learner)
      OR app.tutor_can_see_learner(target_learner)
$$;
--> statement-breakpoint

-- Admin, the learner's family, or the (working) tutor on the enrollment.
CREATE FUNCTION app.can_see_enrollment(target_enrollment uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.id = target_enrollment
      AND (
        app.is_admin()
        OR app.is_family_of(e.learner_id)
        OR e.tutor_id = app.my_working_tutor_id()
      )
  )
$$;
--> statement-breakpoint

-- Anyone who can see the enrollment, plus whoever took the session over.
CREATE FUNCTION app.can_see_session(target_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = target_session
      AND (
        app.can_see_enrollment(s.enrollment_id)
        OR s.taught_by = app.my_working_tutor_id()
      )
  )
$$;
--> statement-breakpoint

-- I am a working tutor and I taught (or am teaching) this session.
CREATE FUNCTION app.i_teach_session(target_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sessions
    WHERE id = target_session AND taught_by = app.my_working_tutor_id()
  )
$$;
--> statement-breakpoint

-- Myself, admin, or a tutor enrolled with one of my learners.
CREATE FUNCTION app.can_see_tutor(target_tutor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT app.is_admin()
      OR target_tutor = app.my_tutor_id()
      OR EXISTS (
        SELECT 1 FROM enrollments
        WHERE tutor_id = target_tutor
          AND status = 'active'
          AND app.is_family_of(learner_id)
      )
$$;
--> statement-breakpoint

-- Thread participants and admin. For a minor's thread, the account holder too.
CREATE FUNCTION app.can_see_thread(target_thread uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM threads t
    LEFT JOIN learners l ON l.id = t.learner_id
    WHERE t.id = target_thread
      AND (
        app.is_admin()
        OR app.current_profile_id() = ANY (t.participant_ids)
        OR (l.is_minor AND app.is_account_holder_of(l.id))
      )
  )
$$;
--> statement-breakpoint

-- Whose name can I see? Myself, anyone I share a thread with,
-- and the tutors my learners are enrolled with. (Emails are never readable.)
CREATE FUNCTION app.can_see_profile(target_profile uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT target_profile = app.current_profile_id()
      OR app.is_admin()
      OR EXISTS (
        SELECT 1 FROM threads
        WHERE target_profile = ANY (participant_ids)
          AND app.current_profile_id() = ANY (participant_ids)
      )
      OR EXISTS (
        SELECT 1 FROM tutors t
        WHERE t.profile_id = target_profile AND app.can_see_tutor(t.id)
      )
$$;
--> statement-breakpoint

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_user;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Table permissions for app_user (what kind of access, before row filtering)
-- -----------------------------------------------------------------------------

-- Profiles: no email column, and only your own name is editable.
GRANT SELECT (id, role, name, created_at) ON profiles TO app_user;
--> statement-breakpoint
GRANT UPDATE (name) ON profiles TO app_user;
--> statement-breakpoint
GRANT SELECT ON accounts, invites, tutors, enrollments, sessions,
  threads, payments, payouts TO app_user;
--> statement-breakpoint
-- profile_id is left out on purpose: a learner's own login is linked only by
-- accepting an invite (server code), never by the family setting it directly.
GRANT SELECT ON learners TO app_user;
--> statement-breakpoint
GRANT INSERT (account_id, name, grade, is_minor, goals, baseline) ON learners TO app_user;
--> statement-breakpoint
GRANT UPDATE (name, grade, goals, baseline) ON learners TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON availability TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON session_notes TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT ON progress_entries TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT ON messages TO app_user;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Turn RLS on for every table
-- -----------------------------------------------------------------------------

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE learners         ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invites          ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tutors           ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE availability     ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE enrollments      ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE session_notes    ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE progress_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE threads          ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE payouts          ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Policies, table by table
-- -----------------------------------------------------------------------------

-- profiles
CREATE POLICY profiles_read ON profiles FOR SELECT TO app_user
  USING (app.can_see_profile(id));
--> statement-breakpoint
CREATE POLICY profiles_edit_own ON profiles FOR UPDATE TO app_user
  USING (id = app.current_profile_id())
  WITH CHECK (id = app.current_profile_id());
--> statement-breakpoint

-- accounts
CREATE POLICY accounts_read ON accounts FOR SELECT TO app_user
  USING (owner_id = app.current_profile_id() OR app.is_admin());
--> statement-breakpoint

-- learners: family, admin, and the learner's working tutors can read;
-- the account holder can add and edit learners on their own account.
CREATE POLICY learners_read ON learners FOR SELECT TO app_user
  USING (app.can_see_learner(id));
--> statement-breakpoint
CREATE POLICY learners_add ON learners FOR INSERT TO app_user
  WITH CHECK (
    account_id IN (SELECT id FROM accounts WHERE owner_id = app.current_profile_id())
  );
--> statement-breakpoint
CREATE POLICY learners_edit ON learners FOR UPDATE TO app_user
  USING (app.is_account_holder_of(id))
  WITH CHECK (app.is_account_holder_of(id));
--> statement-breakpoint

-- invites: admin, and whoever sent the invite.
CREATE POLICY invites_read ON invites FOR SELECT TO app_user
  USING (created_by = app.current_profile_id() OR app.is_admin());
--> statement-breakpoint

-- tutors
CREATE POLICY tutors_read ON tutors FOR SELECT TO app_user
  USING (app.can_see_tutor(id));
--> statement-breakpoint

-- availability: visible to whoever can see the tutor; edited by the tutor.
CREATE POLICY availability_read ON availability FOR SELECT TO app_user
  USING (app.can_see_tutor(tutor_id));
--> statement-breakpoint
CREATE POLICY availability_tutor_edits ON availability FOR ALL TO app_user
  USING (tutor_id = app.my_working_tutor_id())
  WITH CHECK (tutor_id = app.my_working_tutor_id());
--> statement-breakpoint

-- enrollments
CREATE POLICY enrollments_read ON enrollments FOR SELECT TO app_user
  USING (app.can_see_enrollment(id));
--> statement-breakpoint

-- sessions
CREATE POLICY sessions_read ON sessions FOR SELECT TO app_user
  USING (app.can_see_session(id));
--> statement-breakpoint

-- session_notes: readable with the session; written by whoever taught it.
CREATE POLICY session_notes_read ON session_notes FOR SELECT TO app_user
  USING (app.can_see_session(session_id));
--> statement-breakpoint
CREATE POLICY session_notes_add ON session_notes FOR INSERT TO app_user
  WITH CHECK (
    app.i_teach_session(session_id) AND author_id = app.current_profile_id()
  );
--> statement-breakpoint
CREATE POLICY session_notes_edit ON session_notes FOR UPDATE TO app_user
  USING (app.i_teach_session(session_id))
  WITH CHECK (
    app.i_teach_session(session_id) AND author_id = app.current_profile_id()
  );
--> statement-breakpoint

-- progress_entries: readable with the learner; added by the learner's tutor.
CREATE POLICY progress_read ON progress_entries FOR SELECT TO app_user
  USING (app.can_see_learner(learner_id));
--> statement-breakpoint
CREATE POLICY progress_add ON progress_entries FOR INSERT TO app_user
  WITH CHECK (app.tutor_can_see_learner(learner_id));
--> statement-breakpoint

-- threads and messages
CREATE POLICY threads_read ON threads FOR SELECT TO app_user
  USING (app.can_see_thread(id));
--> statement-breakpoint
CREATE POLICY messages_read ON messages FOR SELECT TO app_user
  USING (app.can_see_thread(thread_id));
--> statement-breakpoint
-- Only participants (and admin) can send. A minor's account holder can read
-- the learner's thread with the tutor but not post in it.
CREATE POLICY messages_send ON messages FOR INSERT TO app_user
  WITH CHECK (
    sender_id = app.current_profile_id()
    AND (
      app.is_admin()
      OR EXISTS (
        SELECT 1 FROM threads t
        WHERE t.id = messages.thread_id
          AND app.current_profile_id() = ANY (t.participant_ids)
      )
    )
  );
--> statement-breakpoint

-- payments: admin and the family that paid.
CREATE POLICY payments_read ON payments FOR SELECT TO app_user
  USING (
    app.is_admin()
    OR EXISTS (
      SELECT 1 FROM sessions s
      JOIN enrollments e ON e.id = s.enrollment_id
      WHERE s.id = payments.session_id AND app.is_family_of(e.learner_id)
    )
  );
--> statement-breakpoint

-- payouts: admin and the tutor being paid.
CREATE POLICY payouts_read ON payouts FOR SELECT TO app_user
  USING (tutor_id = app.my_tutor_id() OR app.is_admin());
