ALTER TABLE "learners" ALTER COLUMN "account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "subjects" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "consent_given_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "learners" ADD COLUMN "consent_given_by" uuid;--> statement-breakpoint
ALTER TABLE "learners" ADD CONSTRAINT "learners_consent_given_by_profiles_id_fk" FOREIGN KEY ("consent_given_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;