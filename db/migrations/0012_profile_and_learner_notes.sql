CREATE TABLE "learner_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"strengths" text,
	"weaknesses" text,
	"next_focus" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "languages" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "fun_fact" text;--> statement-breakpoint
ALTER TABLE "tutors" ADD COLUMN "profile_draft" jsonb;--> statement-breakpoint
ALTER TABLE "learner_notes" ADD CONSTRAINT "learner_notes_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_notes" ADD CONSTRAINT "learner_notes_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learner_notes_one_per_subject" ON "learner_notes" USING btree ("learner_id",lower("subject"));