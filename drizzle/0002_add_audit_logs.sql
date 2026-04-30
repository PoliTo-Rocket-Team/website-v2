CREATE TABLE "logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "schema_name" text NOT NULL,
  "table_name" text NOT NULL,
  "operation" text NOT NULL,
  "record_id" text,
  "old_data" jsonb,
  "new_data" jsonb,
  "changed_by" text,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.log_db_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_id TEXT;
  target_record_id TEXT;
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  actor_id := COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'),
    better_auth.uid(),
    current_user
  );

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
--> statement-breakpoint

DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('public', 'better_auth')
      AND NOT (schemaname = 'public' AND tablename = 'logs')
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS audit_row_changes ON %I.%I',
      table_record.schemaname,
      table_record.tablename
    );

    EXECUTE format(
      'CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.log_db_changes()',
      table_record.schemaname,
      table_record.tablename
    );
  END LOOP;
END
$$;
