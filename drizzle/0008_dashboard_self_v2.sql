CREATE TABLE "interview_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"chosen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_leaves" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"reason" text,
	"left_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" DROP CONSTRAINT "applications_user_position_unique";--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_leaves" ADD CONSTRAINT "team_leaves_member_id_members_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_slots_application_idx" ON "interview_slots" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_slots_one_chosen" ON "interview_slots" USING btree ("application_id") WHERE "interview_slots"."chosen";--> statement-breakpoint
CREATE INDEX "team_leaves_member_idx" ON "team_leaves" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_user_position_active" ON "applications" USING btree ("user_id","apply_position_id") WHERE "applications"."withdrawn_at" is null;