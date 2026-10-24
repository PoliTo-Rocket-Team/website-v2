-- Writes made in a View as session record both people (issue #605, epic
-- #597). The person viewed as stays where each write already names its
-- author; the acting account (the session's `impersonatedBy`, read on the
-- server) is stored beside it: in `logs.changed_by_acting_account`, which
-- the audit trigger fills from the `request.acting_account` setting
-- lib/db-audit.ts sets, and in a companion column next to each member-id
-- "by" column, which the dashboard's writes fill. Every new column is null
-- for a write made outside View as.
--
-- Additive only: every preview build applies this to the shared preview
-- database. Each column is new and nullable, each constraint names only a
-- new column, and the trigger function is replaced in place, so no existing
-- row or column changes.
ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "changed_by_acting_account" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "nda_confirmed_by_acting_account" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reviewed_by_acting_account" text;--> statement-breakpoint
ALTER TABLE "team_joins" ADD COLUMN IF NOT EXISTS "added_by_acting_account" text;--> statement-breakpoint
ALTER TABLE "hand_over_requests" ADD COLUMN IF NOT EXISTS "decided_by_acting_account" text;--> statement-breakpoint
ALTER TABLE "alias_requests" ADD COLUMN IF NOT EXISTS "requested_by_acting_account" text;--> statement-breakpoint
ALTER TABLE "alias_requests" ADD COLUMN IF NOT EXISTS "answered_by_acting_account" text;--> statement-breakpoint
ALTER TABLE "scopes" ADD COLUMN IF NOT EXISTS "given_by_acting_account" text;--> statement-breakpoint
-- Each foreign key is added only when it is not there yet: the shared preview
-- database may already hold them from a preview build that applied this file
-- under its earlier number (0056, before the trunk's 0055 took that number).
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_changed_by_acting_account_users_id_fk') THEN ALTER TABLE "logs" ADD CONSTRAINT "logs_changed_by_acting_account_users_id_fk" FOREIGN KEY ("changed_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_nda_confirmed_by_acting_account_users_id_fk') THEN ALTER TABLE "members" ADD CONSTRAINT "members_nda_confirmed_by_acting_account_users_id_fk" FOREIGN KEY ("nda_confirmed_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_reviewed_by_acting_account_users_id_fk') THEN ALTER TABLE "orders" ADD CONSTRAINT "orders_reviewed_by_acting_account_users_id_fk" FOREIGN KEY ("reviewed_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_joins_added_by_acting_account_users_id_fk') THEN ALTER TABLE "team_joins" ADD CONSTRAINT "team_joins_added_by_acting_account_users_id_fk" FOREIGN KEY ("added_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hand_over_requests_decided_by_acting_account_users_id_fk') THEN ALTER TABLE "hand_over_requests" ADD CONSTRAINT "hand_over_requests_decided_by_acting_account_users_id_fk" FOREIGN KEY ("decided_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alias_requests_requested_by_acting_account_users_id_fk') THEN ALTER TABLE "alias_requests" ADD CONSTRAINT "alias_requests_requested_by_acting_account_users_id_fk" FOREIGN KEY ("requested_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alias_requests_answered_by_acting_account_users_id_fk') THEN ALTER TABLE "alias_requests" ADD CONSTRAINT "alias_requests_answered_by_acting_account_users_id_fk" FOREIGN KEY ("answered_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scopes_given_by_acting_account_users_id_fk') THEN ALTER TABLE "scopes" ADD CONSTRAINT "scopes_given_by_acting_account_users_id_fk" FOREIGN KEY ("given_by_acting_account") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;--> statement-breakpoint

-- As drizzle/0003 left it, plus the acting account: read from the setting,
-- kept only when it names a known user (an unknown id is dropped, as the
-- writer's is, so the write itself never fails on it).
CREATE OR REPLACE FUNCTION public.log_db_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  raw_actor_id TEXT;
  actor_id TEXT;
  raw_acting_id TEXT;
  acting_id TEXT;
  target_record_id TEXT;
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  raw_actor_id := COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'),
    better_auth.uid()
  );

  IF raw_actor_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE public.users.id = raw_actor_id
  ) THEN
    actor_id := raw_actor_id;
  ELSE
    actor_id := NULL;
  END IF;

  raw_acting_id := NULLIF(current_setting('request.acting_account', true), '');

  IF raw_acting_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.users
    WHERE public.users.id = raw_acting_id
  ) THEN
    acting_id := raw_acting_id;
  ELSE
    acting_id := NULL;
  END IF;

  target_record_id := COALESCE(
    to_jsonb(NEW) ->> 'id',
    to_jsonb(OLD) ->> 'id',
    to_jsonb(NEW) ->> 'member_id',
    to_jsonb(OLD) ->> 'member_id'
  );

  INSERT INTO public.logs (
    schema_name,
    table_name,
    operation,
    record_id,
    old_data,
    new_data,
    changed_by,
    changed_by_acting_account
  )
  VALUES (
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    TG_OP,
    target_record_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    actor_id,
    acting_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ SECURITY DEFINER;
