ALTER TYPE "public"."status" ADD VALUE 'changes_requested';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "team_from" integer;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "team_to" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reviewed_by" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_reviewed_by_members_member_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."members"("member_id") ON DELETE no action ON UPDATE no action;