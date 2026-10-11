CREATE TABLE "team_joins" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"division_id" integer NOT NULL,
	"title" text,
	"prt_email" text,
	"discord" text,
	"added_by" integer,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_joins" ADD CONSTRAINT "team_joins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "team_joins" ADD CONSTRAINT "team_joins_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_joins" ADD CONSTRAINT "team_joins_added_by_members_member_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_joins_user_division" ON "team_joins" USING btree ("user_id","division_id");--> statement-breakpoint
CREATE INDEX "team_joins_division_idx" ON "team_joins" USING btree ("division_id");