create schema if not exists "better_auth";

create table "better_auth"."account" (
    "id" text not null,
    "accountId" text not null,
    "providerId" text not null,
    "userId" text not null,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    "scope" text,
    "password" text,
    "createdAt" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone not null
);


create table "better_auth"."session" (
    "id" text not null,
    "expiresAt" timestamp with time zone not null,
    "token" text not null,
    "createdAt" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone not null,
    "ipAddress" text,
    "userAgent" text,
    "userId" text not null
);


create table "better_auth"."user" (
    "id" text not null,
    "name" text not null,
    "email" text not null,
    "emailVerified" boolean not null,
    "image" text,
    "createdAt" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone not null default CURRENT_TIMESTAMP
);


create table "better_auth"."verification" (
    "id" text not null,
    "identifier" text not null,
    "value" text not null,
    "expiresAt" timestamp with time zone not null,
    "createdAt" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone not null default CURRENT_TIMESTAMP
);


CREATE UNIQUE INDEX account_pkey ON better_auth.account USING btree (id);

CREATE INDEX "account_userId_idx" ON better_auth.account USING btree ("userId");

CREATE UNIQUE INDEX session_pkey ON better_auth.session USING btree (id);

CREATE UNIQUE INDEX session_token_key ON better_auth.session USING btree (token);

CREATE INDEX "session_userId_idx" ON better_auth.session USING btree ("userId");

CREATE UNIQUE INDEX user_email_key ON better_auth."user" USING btree (email);

CREATE UNIQUE INDEX user_pkey ON better_auth."user" USING btree (id);

CREATE INDEX verification_identifier_idx ON better_auth.verification USING btree (identifier);

CREATE UNIQUE INDEX verification_pkey ON better_auth.verification USING btree (id);

alter table "better_auth"."account" add constraint "account_pkey" PRIMARY KEY using index "account_pkey";

alter table "better_auth"."session" add constraint "session_pkey" PRIMARY KEY using index "session_pkey";

alter table "better_auth"."user" add constraint "user_pkey" PRIMARY KEY using index "user_pkey";

alter table "better_auth"."verification" add constraint "verification_pkey" PRIMARY KEY using index "verification_pkey";

alter table "better_auth"."account" add constraint "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES better_auth."user"(id) ON DELETE CASCADE not valid;

alter table "better_auth"."account" validate constraint "account_userId_fkey";

alter table "better_auth"."session" add constraint "session_token_key" UNIQUE using index "session_token_key";

alter table "better_auth"."session" add constraint "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES better_auth."user"(id) ON DELETE CASCADE not valid;

alter table "better_auth"."session" validate constraint "session_userId_fkey";

alter table "better_auth"."user" add constraint "user_email_key" UNIQUE using index "user_email_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION better_auth.uid()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select
  	coalesce(
		nullif(current_setting('request.jwt.claim.sub', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
	)::text
$function$
;

-- //! todo may need review/refactor security implications of this function

CREATE OR REPLACE FUNCTION public.sync_auth_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE 
  existing_user TEXT;
BEGIN
  -- Check if the user's email already exists in the users table
  SELECT id INTO existing_user FROM public.users WHERE email = NEW.email;

  -- If the user already exists and their id is different, update their ID with the new id from better_auth.user
  IF existing_user IS NOT NULL AND existing_user <> NEW.id THEN
    UPDATE public.users SET id = NEW.id WHERE email = NEW.email;
  ELSIF existing_user IS NULL THEN
    -- Insert new user into users table
    INSERT INTO public.users (id, email, created_at)
    VALUES (NEW.id, NEW.email, NOW());
  END IF;

  RETURN NEW;
END;
$$ SECURITY DEFINER;



CREATE TRIGGER on_better_auth_user_created
AFTER INSERT ON better_auth.user
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_users();