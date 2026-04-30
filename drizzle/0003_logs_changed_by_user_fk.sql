UPDATE public.logs AS logs
SET changed_by = NULL
WHERE logs.changed_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE public.users.id = logs.changed_by
  );
--> statement-breakpoint

ALTER TABLE "logs"
ADD CONSTRAINT "logs_changed_by_users_id_fk"
FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.log_db_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  raw_actor_id TEXT;
  actor_id TEXT;
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
    changed_by
  )
  VALUES (
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    TG_OP,
    target_record_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    actor_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ SECURITY DEFINER;
