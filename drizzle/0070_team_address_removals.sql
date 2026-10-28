-- Team address removals (issue #797): someone who may request a team
-- address for its holder removes it, and the approvers turn its routing off
-- in Google Workspace and press Mark done. Mark done deletes the
-- `team_addresses` row, so the address can be requested again for someone
-- else; the removal row keeps the address, whose it was, who removed it and
-- who marked it done. lib/dashboard/team-address.ts owns the rules.
--
-- Additive only: every preview build applies this to the shared preview
-- database. One new table with its foreign keys, its one-open index, its
-- checks and its audit trigger. Nothing is dropped, renamed or rewritten, and
-- no row is added or changed.
--
-- `address_id` is set null when Mark done deletes the address, so the
-- history stays. `team_address_removals_one_open` keeps one open removal per
-- address, and `team_address_removals_open_address` keeps an open one tied to
-- its address.
--
-- Written to apply again over a database that already holds it (as 0066 to
-- 0069 are), so a renumbered copy applies cleanly.
CREATE TABLE IF NOT EXISTS "team_address_removals" (
	"id" serial PRIMARY KEY NOT NULL,
	"address_id" integer,
	"address" text NOT NULL,
	"from_member" integer,
	"removed_by" integer,
	"removed_by_acting_account" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_by" integer,
	"done_by_acting_account" text,
	"done_at" timestamp with time zone,
	CONSTRAINT "team_address_removals_done" CHECK ("team_address_removals"."done_by" is null or "team_address_removals"."done_at" is not null),
	CONSTRAINT "team_address_removals_open_address" CHECK ("team_address_removals"."done_at" is not null or "team_address_removals"."address_id" is not null)
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_removals_address_id_team_addresses_id_fk') THEN ALTER TABLE "team_address_removals" ADD CONSTRAINT "team_address_removals_address_id_team_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."team_addresses"("id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_removals_from_member_members_member_id_fk') THEN ALTER TABLE "team_address_removals" ADD CONSTRAINT "team_address_removals_from_member_members_member_id_fk" FOREIGN KEY ("from_member") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_removals_removed_by_members_member_id_fk') THEN ALTER TABLE "team_address_removals" ADD CONSTRAINT "team_address_removals_removed_by_members_member_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_removals_removed_by_acting_account_users_id_fk') THEN ALTER TABLE "team_address_removals" ADD CONSTRAINT "team_address_removals_removed_by_acting_account_users_id_fk" FOREIGN KEY ("removed_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_removals_done_by_members_member_id_fk') THEN ALTER TABLE "team_address_removals" ADD CONSTRAINT "team_address_removals_done_by_members_member_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_removals_done_by_acting_account_users_id_fk') THEN ALTER TABLE "team_address_removals" ADD CONSTRAINT "team_address_removals_done_by_acting_account_users_id_fk" FOREIGN KEY ("done_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_address_removals_one_open" ON "team_address_removals" USING btree ("address_id") WHERE "team_address_removals"."done_at" is null;--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.team_address_removals FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
