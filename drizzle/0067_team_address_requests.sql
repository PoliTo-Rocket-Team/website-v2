-- Team address requests (epic #578, issue #787, board 102b): a division
-- lead, a department head or a full-access holder asks for a shared team
-- address for a member, with what it is for and, optionally, the role it
-- moves with. The approvers answer it in a later slice. Shaped like
-- `alias_requests`; lib/dashboard/team-address.ts owns the rules.
--
-- Additive only: every preview build applies this to the shared preview
-- database. One new type, one new table with its foreign keys, its two
-- indexes, its two checks and its audit trigger. Nothing is dropped, renamed
-- or rewritten, and no row is added or changed.
--
-- The tie columns and `team_address_requests_tie` are those of
-- `team_addresses` (drizzle/0066), so a request carries exactly the tie the
-- created address will. `team_address_requests_one_open` keeps one open
-- request per address in any letter case, so a race between two requests
-- for one address is refused by the database too.
--
-- Written to apply again over a database that already holds it (as 0063 to
-- 0066 are), so a renumbered copy applies cleanly.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_address_request_outcome') THEN CREATE TYPE "public"."team_address_request_outcome" AS ENUM('created', 'declined', 'cancelled'); END IF; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_address_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"address" text NOT NULL,
	"purpose" text NOT NULL,
	"moves_with" "team_address_tie",
	"moves_with_seat" "full_access_seat",
	"moves_with_dept_id" integer,
	"moves_with_division_id" integer,
	"requested_by" integer,
	"requested_by_acting_account" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" "team_address_request_outcome",
	"answered_by" integer,
	"answered_by_acting_account" text,
	"answered_at" timestamp with time zone,
	CONSTRAINT "team_address_requests_tie" CHECK (("team_address_requests"."moves_with" is null and "team_address_requests"."moves_with_seat" is null and "team_address_requests"."moves_with_dept_id" is null and "team_address_requests"."moves_with_division_id" is null)
      or ("team_address_requests"."moves_with" is not distinct from 'team_leader' and "team_address_requests"."moves_with_seat" is null and "team_address_requests"."moves_with_dept_id" is null and "team_address_requests"."moves_with_division_id" is null)
      or ("team_address_requests"."moves_with" is not distinct from 'full_access_seat' and "team_address_requests"."moves_with_seat" is not null and "team_address_requests"."moves_with_dept_id" is null and "team_address_requests"."moves_with_division_id" is null)
      or ("team_address_requests"."moves_with" is not distinct from 'department_head' and "team_address_requests"."moves_with_seat" is null and "team_address_requests"."moves_with_dept_id" is not null and "team_address_requests"."moves_with_division_id" is null)
      or ("team_address_requests"."moves_with" is not distinct from 'division_lead' and "team_address_requests"."moves_with_seat" is null and "team_address_requests"."moves_with_dept_id" is null and "team_address_requests"."moves_with_division_id" is not null)),
	CONSTRAINT "team_address_requests_answered" CHECK (("team_address_requests"."outcome" is null) = ("team_address_requests"."answered_at" is null))
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_requests_member_id_members_member_id_fk') THEN ALTER TABLE "team_address_requests" ADD CONSTRAINT "team_address_requests_member_id_members_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("member_id") ON DELETE cascade ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_requests_moves_with_dept_id_departments_id_fk') THEN ALTER TABLE "team_address_requests" ADD CONSTRAINT "team_address_requests_moves_with_dept_id_departments_id_fk" FOREIGN KEY ("moves_with_dept_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_requests_moves_with_division_id_divisions_id_fk') THEN ALTER TABLE "team_address_requests" ADD CONSTRAINT "team_address_requests_moves_with_division_id_divisions_id_fk" FOREIGN KEY ("moves_with_division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_requests_requested_by_members_member_id_fk') THEN ALTER TABLE "team_address_requests" ADD CONSTRAINT "team_address_requests_requested_by_members_member_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_requests_requested_by_acting_account_users_id_fk') THEN ALTER TABLE "team_address_requests" ADD CONSTRAINT "team_address_requests_requested_by_acting_account_users_id_fk" FOREIGN KEY ("requested_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_requests_answered_by_members_member_id_fk') THEN ALTER TABLE "team_address_requests" ADD CONSTRAINT "team_address_requests_answered_by_members_member_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_address_requests_answered_by_acting_account_users_id_fk') THEN ALTER TABLE "team_address_requests" ADD CONSTRAINT "team_address_requests_answered_by_acting_account_users_id_fk" FOREIGN KEY ("answered_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "team_address_requests_one_open" ON "team_address_requests" USING btree (lower("address")) WHERE "team_address_requests"."outcome" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_address_requests_member_idx" ON "team_address_requests" USING btree ("member_id");--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.team_address_requests FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
