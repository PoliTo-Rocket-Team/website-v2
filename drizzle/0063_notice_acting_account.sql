-- A dashboard notice written in a View as session records the acting account
-- behind it (issue #628, epic #597), as every other write made there does
-- since #605: the notice's own rows keep naming the person viewed as, and
-- `written_by_acting_account` holds the session's acting account, read on the
-- server. The notices that name who acted then read "IT lead as Sara Conti".
-- The column is null for a notice written outside View as.
--
-- Additive only: every preview build applies this to the shared preview
-- database. The column is new and nullable, and the constraint names only
-- it, so no existing row or column changes, and every stored notice keeps
-- reading as it does today.
ALTER TABLE "dashboard_notices" ADD COLUMN IF NOT EXISTS "written_by_acting_account" text;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dashboard_notices_written_by_acting_account_users_id_fk') THEN ALTER TABLE "dashboard_notices" ADD CONSTRAINT "dashboard_notices_written_by_acting_account_users_id_fk" FOREIGN KEY ("written_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;
