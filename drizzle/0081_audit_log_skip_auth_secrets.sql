-- The audit log keeps no Better Auth secret (issue #937,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/937). The audit
-- trigger stored every changed row whole, so each write to a Better Auth
-- table copied its secrets into `logs`. From here the trigger stores a row of
-- `better_auth.account` without `accessToken`, `refreshToken`, `idToken` and
-- `password`, of `better_auth.session` without `token`, and of
-- `better_auth.verification` without `value`. Every other key stays, so the
-- log still says which row changed, when and for whom. Rows of every other
-- table are stored whole, as before.
--
-- Then the copies already stored lose the same keys. Only the `logs` rows of
-- those three tables that hold one of the keys change, and only in
-- `old_data` and `new_data`: no row is deleted, and the rows the app writes
-- itself (View as starts and stops, the break-glass sign-in) hold none of the
-- keys, so they stay byte for byte.
--
-- Additive in the repo's sense: every preview build applies this to the
-- shared preview database and every production build to production. The
-- function is replaced in place and the scrub rewrites only secret keys, so
-- older code keeps working, and a second run finds no key left and changes
-- nothing.

-- As drizzle/0061 left it, plus the secret keys each Better Auth table leaves out.
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
  secret_keys TEXT[] := '{}'::TEXT[];
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_SCHEMA = 'better_auth' THEN
    secret_keys := CASE TG_TABLE_NAME
      WHEN 'account' THEN ARRAY['accessToken', 'refreshToken', 'idToken', 'password']
      WHEN 'session' THEN ARRAY['token']
      WHEN 'verification' THEN ARRAY['value']
      ELSE '{}'::TEXT[]
    END;
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
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) - secret_keys END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) - secret_keys END,
    actor_id,
    acting_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ SECURITY DEFINER;--> statement-breakpoint

-- The scrub: one statement per table, each touching only rows that still
-- hold one of that table's secret keys, and in each row only the data column
-- that holds one.
UPDATE "public"."logs" SET
  "old_data" = CASE WHEN jsonb_typeof("old_data") = 'object' AND "old_data" ?| ARRAY['accessToken', 'refreshToken', 'idToken', 'password'] THEN "old_data" - ARRAY['accessToken', 'refreshToken', 'idToken', 'password'] ELSE "old_data" END,
  "new_data" = CASE WHEN jsonb_typeof("new_data") = 'object' AND "new_data" ?| ARRAY['accessToken', 'refreshToken', 'idToken', 'password'] THEN "new_data" - ARRAY['accessToken', 'refreshToken', 'idToken', 'password'] ELSE "new_data" END
WHERE "schema_name" = 'better_auth' AND "table_name" = 'account'
  AND ((jsonb_typeof("old_data") = 'object' AND "old_data" ?| ARRAY['accessToken', 'refreshToken', 'idToken', 'password'])
    OR (jsonb_typeof("new_data") = 'object' AND "new_data" ?| ARRAY['accessToken', 'refreshToken', 'idToken', 'password']));--> statement-breakpoint
UPDATE "public"."logs" SET
  "old_data" = CASE WHEN jsonb_typeof("old_data") = 'object' AND "old_data" ? 'token' THEN "old_data" - 'token' ELSE "old_data" END,
  "new_data" = CASE WHEN jsonb_typeof("new_data") = 'object' AND "new_data" ? 'token' THEN "new_data" - 'token' ELSE "new_data" END
WHERE "schema_name" = 'better_auth' AND "table_name" = 'session'
  AND ((jsonb_typeof("old_data") = 'object' AND "old_data" ? 'token')
    OR (jsonb_typeof("new_data") = 'object' AND "new_data" ? 'token'));--> statement-breakpoint
UPDATE "public"."logs" SET
  "old_data" = CASE WHEN jsonb_typeof("old_data") = 'object' AND "old_data" ? 'value' THEN "old_data" - 'value' ELSE "old_data" END,
  "new_data" = CASE WHEN jsonb_typeof("new_data") = 'object' AND "new_data" ? 'value' THEN "new_data" - 'value' ELSE "new_data" END
WHERE "schema_name" = 'better_auth' AND "table_name" = 'verification'
  AND ((jsonb_typeof("old_data") = 'object' AND "old_data" ? 'value')
    OR (jsonb_typeof("new_data") = 'object' AND "new_data" ? 'value'));
