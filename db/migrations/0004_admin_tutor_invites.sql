ALTER TABLE "tutors" ALTER COLUMN "profile_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "tutor_id" uuid;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_one_active_per_subject" ON "enrollments" USING btree ("learner_id",lower("subject")) WHERE status = 'active';