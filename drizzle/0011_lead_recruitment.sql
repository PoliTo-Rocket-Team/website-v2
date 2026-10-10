ALTER TYPE "public"."application_status" ADD VALUE 'interview';--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'joined';--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "nda_arrived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "joined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interview_slots" ADD COLUMN "chosen_at" timestamp with time zone;