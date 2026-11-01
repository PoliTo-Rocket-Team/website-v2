-- Personal PRT email removals (issue #931,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/931): when a member
-- whose `members.prt_email` is set holds no active role any more, the alias
-- approvers (team leader, operations lead, IT lead) get a task to delete the
-- mailbox in Google Workspace. Mark done clears the PRT email; Keep address
-- leaves it. lib/dashboard/prt-email-removal.ts owns the rules.
--
-- The database opens and cancels the tasks itself, so every way of leaving
-- the team is covered, today's and any added later: Leave the team, Move to
-- alumni, a hand-over that ends the sender's last role, ending an advisor
-- role, removing a member from a division. A role write is judged when its
-- transaction commits (a deferred constraint trigger), on the member's roles
-- as the whole write left them, so a hand-over that ends a lead role and
-- starts an advisor role in one write opens nothing:
--
-- - a member who loses an active role and then holds none, with a non-empty
--   PRT email, gets one open removal for that address, unless one is open
--   already (`prt_email_removals_one_open`; the insert does nothing then);
-- - a member who holds no active role any more also has their own open PRT
--   email request (`alias_requests`) closed as cancelled; the audit trigger
--   logs it, so it shows in the activity log (Owner decision, 2026-10-31);
-- - a member who holds an active role other than an advisor role (rejoins the
--   team) has their open removal closed as cancelled;
-- - a member whose only active roles are advisor roles is left as they are:
--   a leave that keeps an advisor role opens no removal and keeps the open
--   request, and taking an advisor role again leaves an open removal open for
--   the approvers to answer (Owner decision, 2026-10-31).
--
-- A role write that ends no active role and starts none (a title edit, a fix
-- to an old role's dates) is not judged, so an address kept with Keep address
-- gets no new removal until the member holds a role again and loses it. The
-- trigger never raises, so a leave is never refused because of a removal.
--
-- Additive only: every preview build applies this to the shared preview
-- database. One new type, one new table with its foreign keys, its two
-- indexes, its check and its audit trigger, one new function and three new
-- triggers on `roles`. Nothing is dropped, renamed or rewritten, no row is
-- added or changed, and no removal is opened for anyone who left before it.
--
-- Written to apply again over a database that already holds it, so a
-- renumbered copy applies cleanly.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prt_email_removal_outcome') THEN CREATE TYPE "public"."prt_email_removal_outcome" AS ENUM('removed', 'kept', 'cancelled'); END IF; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prt_email_removals" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" "prt_email_removal_outcome",
	"answered_by" integer,
	"answered_by_acting_account" text,
	"answered_at" timestamp with time zone,
	CONSTRAINT "prt_email_removals_answered" CHECK (("prt_email_removals"."outcome" is null) = ("prt_email_removals"."answered_at" is null))
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prt_email_removals_member_id_members_member_id_fk') THEN ALTER TABLE "prt_email_removals" ADD CONSTRAINT "prt_email_removals_member_id_members_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prt_email_removals_answered_by_members_member_id_fk') THEN ALTER TABLE "prt_email_removals" ADD CONSTRAINT "prt_email_removals_answered_by_members_member_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."members"("member_id") ON DELETE set null ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prt_email_removals_answered_by_acting_account_users_id_fk') THEN ALTER TABLE "prt_email_removals" ADD CONSTRAINT "prt_email_removals_answered_by_acting_account_users_id_fk" FOREIGN KEY ("answered_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prt_email_removals_one_open" ON "prt_email_removals" USING btree (lower("address")) WHERE "prt_email_removals"."outcome" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prt_email_removals_member_idx" ON "prt_email_removals" USING btree ("member_id");--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.prt_email_removals FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.settle_prt_email_removals() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  changed integer[];
  person integer;
  held text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    changed := ARRAY[NEW.member_id];
  ELSIF TG_OP = 'DELETE' THEN
    changed := ARRAY[OLD.member_id];
  ELSE
    changed := ARRAY[OLD.member_id, NEW.member_id];
  END IF;
  FOREACH person IN ARRAY changed LOOP
    CONTINUE WHEN person IS NULL;
    IF EXISTS (SELECT 1 FROM public.roles WHERE member_id = person AND leaved_at IS NULL AND type IS DISTINCT FROM 'advisor') THEN
      -- Back on the team: an open removal is no longer owed.
      UPDATE public.prt_email_removals
         SET outcome = 'cancelled', answered_at = now()
       WHERE member_id = person AND outcome IS NULL;
    ELSIF NOT EXISTS (SELECT 1 FROM public.roles WHERE member_id = person AND leaved_at IS NULL) THEN
      -- Off the team: the address is owed a removal, once, and the member's
      -- own open PRT email request is no longer owed.
      SELECT nullif(btrim(prt_email), '') INTO held FROM public.members WHERE member_id = person;
      IF held IS NOT NULL THEN
        INSERT INTO public.prt_email_removals (member_id, address) VALUES (person, held) ON CONFLICT DO NOTHING;
      END IF;
      UPDATE public.alias_requests
         SET outcome = 'cancelled', answered_at = now()
       WHERE member_id = person AND outcome IS NULL;
    END IF;
    -- Advisor roles only: the member keeps the address and any open request,
    -- and an open removal stays open for the approvers to answer.
  END LOOP;
  RETURN NULL;
END;
$$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'settle_prt_email_removals_on_insert' AND tgrelid = 'public.roles'::regclass) THEN
  CREATE CONSTRAINT TRIGGER settle_prt_email_removals_on_insert AFTER INSERT ON public.roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
    WHEN (NEW.leaved_at IS NULL)
    EXECUTE FUNCTION public.settle_prt_email_removals();
END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'settle_prt_email_removals_on_delete' AND tgrelid = 'public.roles'::regclass) THEN
  CREATE CONSTRAINT TRIGGER settle_prt_email_removals_on_delete AFTER DELETE ON public.roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
    WHEN (OLD.leaved_at IS NULL)
    EXECUTE FUNCTION public.settle_prt_email_removals();
END IF; END $$;--> statement-breakpoint
-- Only a write that ends or starts an active role, or moves one to another member, is judged.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'settle_prt_email_removals_on_update' AND tgrelid = 'public.roles'::regclass) THEN
  CREATE CONSTRAINT TRIGGER settle_prt_email_removals_on_update AFTER UPDATE ON public.roles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
    WHEN (
      (OLD.leaved_at IS NULL) <> (NEW.leaved_at IS NULL)
      OR (OLD.member_id IS DISTINCT FROM NEW.member_id AND (OLD.leaved_at IS NULL OR NEW.leaved_at IS NULL))
    )
    EXECUTE FUNCTION public.settle_prt_email_removals();
END IF; END $$;
