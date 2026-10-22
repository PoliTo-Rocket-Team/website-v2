ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_source" text;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_position_unique" UNIQUE("user_id","apply_position_id");