CREATE TABLE "dashboard_notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_id" integer NOT NULL,
	"kind" text NOT NULL,
	"subject_id" integer NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dashboard_notices" ADD CONSTRAINT "dashboard_notices_recipient_id_members_member_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_notices" ADD CONSTRAINT "dashboard_notices_subject_id_members_member_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_notices_recipient_idx" ON "dashboard_notices" USING btree ("recipient_id");