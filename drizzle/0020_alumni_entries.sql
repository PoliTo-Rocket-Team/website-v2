-- The Alumni page from the roles (issue #257): an entry holds only how one
-- person shows on the page, the import's early years and per-year role text.
-- No column here is written by a role, division or access change.
CREATE TYPE "public"."alumni_entry_kind" AS ENUM('member', 'imported', 'advisor');--> statement-breakpoint
CREATE TYPE "public"."alumni_founder" AS ENUM('founder', 'co_founder');--> statement-breakpoint
CREATE TABLE "alumni_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "alumni_entry_kind" NOT NULL,
	"member_id" integer,
	"record_name" text,
	"name" text,
	"founder" "alumni_founder",
	"photo" text,
	"shown" boolean DEFAULT true NOT NULL,
	"removed_at" timestamp with time zone,
	"advisor_role" text,
	"advisor_from" integer,
	"advisor_to" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alumni_entries_member_kind" CHECK (("alumni_entries"."kind" = 'member') = ("alumni_entries"."member_id" is not null)),
	CONSTRAINT "alumni_entries_named" CHECK ("alumni_entries"."kind" = 'member' or "alumni_entries"."record_name" is not null),
	CONSTRAINT "alumni_entries_advisor" CHECK (("alumni_entries"."kind" = 'advisor') = ("alumni_entries"."advisor_role" is not null and "alumni_entries"."advisor_from" is not null and "alumni_entries"."advisor_to" is not null))
);
--> statement-breakpoint
CREATE TABLE "alumni_imported_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"year" integer NOT NULL,
	"group_name" text NOT NULL,
	"role" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alumni_role_fixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"year" integer NOT NULL,
	"group_name" text NOT NULL,
	"role" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alumni_entries" ADD CONSTRAINT "alumni_entries_member_id_members_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alumni_imported_roles" ADD CONSTRAINT "alumni_imported_roles_entry_id_alumni_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."alumni_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alumni_role_fixes" ADD CONSTRAINT "alumni_role_fixes_entry_id_alumni_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."alumni_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alumni_entries_member" ON "alumni_entries" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "alumni_imported_roles_entry_idx" ON "alumni_imported_roles" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alumni_role_fixes_line" ON "alumni_role_fixes" USING btree ("entry_id","year","group_name");