ALTER TABLE "sessions" ADD COLUMN "booked_by" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cancelled_late" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_booked_by_profiles_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cancelled_by_profiles_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_series_idx" ON "sessions" USING btree ("series_id");