-- Let account holders set the new `subjects` field on their learners.
-- The consent fields are deliberately NOT granted: they are written only by
-- server code when a parent accepts the link to a minor.
GRANT INSERT (subjects) ON learners TO app_user;
--> statement-breakpoint
GRANT UPDATE (subjects) ON learners TO app_user;
