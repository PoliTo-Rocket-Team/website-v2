create type "public"."status_type" as enum ('open', 'closed', 'pending', 'approved', 'rejected', 'in_progress', 'completed');

alter table "public"."applications" alter column "applied_at" drop not null;

alter table "public"."applications" alter column "applied_at" set data type date using "applied_at"::date;

alter table "public"."apply_positions" alter column "created_at" drop not null;

alter table "public"."members" alter column "nda_signed_at" drop not null;

alter table "public"."orders" alter column "created_at" drop not null;

alter table "public"."orders" alter column "created_at" set data type date using "created_at"::date;

alter table "public"."users" alter column "email" set not null;

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.sync_auth_users()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE 
  existing_user UUID;
BEGIN
  -- Explicitly reference the public schema
  SELECT id INTO existing_user FROM public.users WHERE email = NEW.email;

  -- If the user already exists and their id is different, update their ID
  IF existing_user IS NOT NULL AND existing_user <> NEW.id THEN
    UPDATE public.users SET id = NEW.id WHERE email = NEW.email;
  ELSIF existing_user IS NULL THEN
    -- Insert new user into users table
    INSERT INTO public.users (id, email, created_at)
    VALUES (NEW.id, NEW.email, NEW.created_at);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log errors
  RAISE LOG 'Error in sync_auth_users: %', SQLERRM;
  RETURN NEW;
END;
$function$
;


