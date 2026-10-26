-- Team address routing items (epic #578, issue #789): when the role a team
-- address moves with changes hands, the role change raises one routing item
-- in its own batch, and the approvers move the address to the new holder
-- with Mark done. lib/dashboard/team-address.ts owns the rules.
--
-- Additive only: every preview build applies this to the shared preview
-- database. One new table with its foreign keys, its one-open index, its
-- check and its audit trigger. Nothing is dropped, renamed or rewritten, and
-- no row is added or changed.
--
-- `team_address_reroutes_one_open` keeps one open item per address, so a
-- second role change before Mark done adds no second item: the automatic
-- insert skips it (`on conflict do nothing`).
--
-- Written to apply again over a database that already holds it (as 0063 to
-- 0067 are), so a renumbered copy applies cleanly.
CREATE TABLE IF NOT EXISTS "team_address_reroutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"address_id" integer NOT NULL,
	"to_member" integer NOT NULL,
	"from_member" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_by" integer,
	"done_by_acting_account" text,
	"done_at" timestamp with time zone,
	CONSTRAINT "team_address_reroutes_done" CHECK ("team_address_reroutes"."done_by" is null or "team_address_reroutes"."done_at" is not null)
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_reroutes_address_id_team_addresses_id_fk') THEN ALTER TABLE "team_address_reroutes" ADD CONSTRAINT "team_address_reroutes_address_id_team_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."team_addresses"("id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_reroutes_to_member_members_member_id_fk') THEN ALTER TABLE "team_address_reroutes" ADD CONSTRAINT "team_address_reroutes_to_member_members_member_id_fk" FOREIGN KEY ("to_member") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_reroutes_from_member_members_member_id_fk') THEN ALTER TABLE "team_address_reroutes" ADD CONSTRAINT "team_address_reroutes_from_member_members_member_id_fk" FOREIGN KEY ("from_member") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_reroutes_done_by_members_member_id_fk') THEN ALTER TABLE "team_address_reroutes" ADD CONSTRAINT "team_address_reroutes_done_by_members_member_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_reroutes_done_by_acting_account_users_id_fk') THEN ALTER TABLE "team_address_reroutes" ADD CONSTRAINT "team_address_reroutes_done_by_acting_account_users_id_fk" FOREIGN KEY ("done_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_address_reroutes_one_open" ON "team_address_reroutes" USING btree ("address_id") WHERE "team_address_reroutes"."done_at" is null;--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.team_address_reroutes FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
