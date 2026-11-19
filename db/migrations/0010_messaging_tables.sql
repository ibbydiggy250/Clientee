CREATE TYPE "public"."message_status" AS ENUM('delivered', 'held', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."thread_kind" AS ENUM('learner_tutor', 'family_tutorme', 'tutor_tutorme');--> statement-breakpoint
CREATE TABLE "thread_reads" (
	"thread_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thread_reads_thread_id_profile_id_pk" PRIMARY KEY("thread_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "status" "message_status" DEFAULT 'delivered' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "flag_reason" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "kind" "thread_kind" DEFAULT 'learner_tutor' NOT NULL;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "tutor_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "thread_reads" ADD CONSTRAINT "thread_reads_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_reads" ADD CONSTRAINT "thread_reads_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_tutor_id_tutors_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_held_idx" ON "messages" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_one_per_learner_tutor" ON "threads" USING btree ("learner_id","tutor_id") WHERE kind = 'learner_tutor';--> statement-breakpoint
CREATE UNIQUE INDEX "threads_one_per_account" ON "threads" USING btree ("account_id") WHERE kind = 'family_tutorme';--> statement-breakpoint
CREATE UNIQUE INDEX "threads_one_per_tutor" ON "threads" USING btree ("tutor_id") WHERE kind = 'tutor_tutorme';