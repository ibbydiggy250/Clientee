-- =============================================================================
-- Messaging: who can read and send what.
--
-- Sending goes through trusted server code (lib/messaging.ts) so the contact
-- filter can never be skipped. Reading through withUser stays possible and is
-- filtered here.
--
-- Note for the future switch to Neon Realtime: Realtime can't subscribe to
-- tables with row-level security on. When that switch happens, the message
-- query in lib/messaging.ts (threadMessagesQuery) already authorizes in its
-- own SQL, and RLS on `messages` would be turned off in that migration.
-- =============================================================================

-- 1. Nobody inserts messages directly any more; lib/messaging.ts does, after
--    the contact filter has decided whether the message is held.
REVOKE INSERT ON messages FROM app_user;
--> statement-breakpoint
DROP POLICY messages_send ON messages;
--> statement-breakpoint

-- 2. Held and rejected messages are visible only to their sender and admin.
DROP POLICY messages_read ON messages;
--> statement-breakpoint
CREATE POLICY messages_read ON messages FOR SELECT TO app_user
  USING (
    app.can_see_thread(thread_id)
    AND (status = 'delivered' OR sender_id = app.current_profile_id() OR app.is_admin())
  );
--> statement-breakpoint

-- 3. A tutor sees a learner's thread only while they may work with that
--    learner (active or offboarding, within 7 days of term end, active match),
--    matching the spec's access rules. Everything else is unchanged.
CREATE OR REPLACE FUNCTION app.can_see_thread(target_thread uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM threads t
    LEFT JOIN learners l ON l.id = t.learner_id
    WHERE t.id = target_thread
      AND (
        app.is_admin()
        OR (
          app.current_profile_id() = ANY (t.participant_ids)
          AND (
            t.kind <> 'learner_tutor'
            OR t.tutor_id IS DISTINCT FROM app.my_tutor_id()
            OR app.tutor_can_see_learner(t.learner_id)
          )
        )
        OR (l.is_minor AND app.is_account_holder_of(l.id))
      )
  )
$$;
--> statement-breakpoint

-- 4. Read markers are private bookkeeping, handled by server code only.
ALTER TABLE thread_reads ENABLE ROW LEVEL SECURITY;
