-- Shared team addresses (epic #578, issue #786): a shared address on the team
-- domain, such as a recruitment or logistics address, what it is for, the one
-- member who holds it, and the role it moves with on a hand-over, if any.
-- lib/dashboard/team-address.ts owns the rules.
--
-- Additive only: every preview build applies this to the shared preview
-- database. One new type, one new table with its foreign keys, its two
-- indexes, its check and its audit trigger. Nothing is dropped, renamed or
-- rewritten, and no row is added or changed.
--
-- The tie is one of four kinds (grill #785, R1.1): the team leader, a
-- full-access seat by its `roles.full_access` flag, a department's head by
-- department id, or a division's lead by division id. `team_addresses_tie`
-- keeps exactly the reference each kind needs, and none for an untied
-- address. `team_addresses_address` keeps one holder per address in any
-- letter case.
--
-- Written to apply again over a database that already holds it (as 0063 to
-- 0065 are), so a renumbered copy applies cleanly.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_address_tie') THEN CREATE TYPE "public"."team_address_tie" AS ENUM('team_leader', 'full_access_seat', 'department_head', 'division_lead'); END IF; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"purpose" text NOT NULL,
	"holder_id" integer NOT NULL,
	"moves_with" "team_address_tie",
	"moves_with_seat" "full_access_seat",
	"moves_with_dept_id" integer,
	"moves_with_division_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_addresses_tie" CHECK (("team_addresses"."moves_with" is null and "team_addresses"."moves_with_seat" is null and "team_addresses"."moves_with_dept_id" is null and "team_addresses"."moves_with_division_id" is null)
      or ("team_addresses"."moves_with" is not distinct from 'team_leader' and "team_addresses"."moves_with_seat" is null and "team_addresses"."moves_with_dept_id" is null and "team_addresses"."moves_with_division_id" is null)
      or ("team_addresses"."moves_with" is not distinct from 'full_access_seat' and "team_addresses"."moves_with_seat" is not null and "team_addresses"."moves_with_dept_id" is null and "team_addresses"."moves_with_division_id" is null)
      or ("team_addresses"."moves_with" is not distinct from 'department_head' and "team_addresses"."moves_with_seat" is null and "team_addresses"."moves_with_dept_id" is not null and "team_addresses"."moves_with_division_id" is null)
      or ("team_addresses"."moves_with" is not distinct from 'division_lead' and "team_addresses"."moves_with_seat" is null and "team_addresses"."moves_with_dept_id" is null and "team_addresses"."moves_with_division_id" is not null))
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_addresses_holder_id_members_member_id_fk') THEN ALTER TABLE "team_addresses" ADD CONSTRAINT "team_addresses_holder_id_members_member_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."members"("member_id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_addresses_moves_with_dept_id_departments_id_fk') THEN ALTER TABLE "team_addresses" ADD CONSTRAINT "team_addresses_moves_with_dept_id_departments_id_fk" FOREIGN KEY ("moves_with_dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_addresses_moves_with_division_id_divisions_id_fk') THEN ALTER TABLE "team_addresses" ADD CONSTRAINT "team_addresses_moves_with_division_id_divisions_id_fk" FOREIGN KEY ("moves_with_division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_addresses_address" ON "team_addresses" USING btree (lower("address"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_addresses_holder_idx" ON "team_addresses" USING btree ("holder_id");--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.team_addresses FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
