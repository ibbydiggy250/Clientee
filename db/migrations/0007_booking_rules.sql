-- =============================================================================
-- Booking rules the database enforces on its own, so no bug in app code can
-- break them. App code checks first and shows friendly messages; these are
-- the backstop.
-- =============================================================================

-- Lets an exclusion rule combine "same tutor" (=) with "overlapping time" (&&).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- A range of clock times (e.g. 15:00–18:00), for weekly availability windows.
CREATE TYPE timerange AS RANGE (subtype = time);
--> statement-breakpoint

-- ---------- Sessions ----------

ALTER TABLE sessions ADD CONSTRAINT sessions_end_after_start CHECK (ends_at > starts_at);
--> statement-breakpoint

-- One tutor can't teach two scheduled sessions at the same time.
-- (Cancelled and finished sessions don't count.)
ALTER TABLE sessions ADD CONSTRAINT sessions_no_double_booking
  EXCLUDE USING gist (taught_by WITH =, tstzrange(starts_at, ends_at) WITH &&)
  WHERE (status = 'scheduled');
--> statement-breakpoint

-- ---------- Weekly availability ----------

ALTER TABLE availability ADD CONSTRAINT availability_weekday_valid CHECK (weekday BETWEEN 0 AND 6);
--> statement-breakpoint
ALTER TABLE availability ADD CONSTRAINT availability_end_after_start CHECK (end_time > start_time);
--> statement-breakpoint

-- A tutor's windows on the same weekday can't overlap. Tutors edit their own
-- hours directly (through row-level security), so this rule lives here.
ALTER TABLE availability ADD CONSTRAINT availability_no_overlap
  EXCLUDE USING gist (tutor_id WITH =, weekday WITH =, timerange(start_time, end_time) WITH &&);
