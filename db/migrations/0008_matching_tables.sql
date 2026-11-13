CREATE TYPE "public"."match_status" AS ENUM('suggested', 'requested', 'accepted', 'approved', 'declined', 'expired', 'skipped', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."study_level" AS ENUM('elementary', 'middle_school', 'high_school', 'ap', 'sat_act', 'college');--> statement-breakpoint
CREATE TABLE "match_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"tutor_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"level" "study_level" NOT NULL,
	"score" integer NOT NULL,
	"rank" smallint NOT NULL,
	"status" "match_status" DEFAULT 'suggested' NOT NULL,
	"requested_by" uuid,
	"expires_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"enrollment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "in_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "is_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "levels" "study_level"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "school_year" text;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "intro_video_url" text;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "bio_draft" text;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "intro_video_url_draft" text;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "max_learners" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "teaching_styles" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "goal_focus" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_requests_learner_idx" ON "match_requests" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "match_requests_tutor_idx" ON "match_requests" USING btree ("tutor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_requests_one_live_per_subject" ON "match_requests" USING btree ("learner_id",lower("subject")) WHERE status in ('requested', 'accepted');