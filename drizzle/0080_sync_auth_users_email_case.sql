-- A first sign-in finds its imported record when the emails differ only in
-- letter case or stray spaces (issue #920,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/920). The trigger of
-- drizzle/0079 matched a free, open `users` row with `email = NEW.email`, an
-- exact compare, while the session repair matches `lower(trim(...))`
-- (`emailIs` in lib/dashboard/database-site-row.ts). With `Mover@mail.test`
-- imported and `mover@mail.test` signing in, the trigger made a fresh row, the
-- session repair then found the login's row and stopped, and the imported
-- record stayed unattached.
--
-- The email match now compares `lower(trim(email)) = lower(trim(NEW.email))`,
-- as the session repair does. It still takes only a row that is open
-- (`deleted_at IS NULL`) and held by no login, and a row with the login's own
-- id still comes first. When more than one free, open row matches, picking one
-- would be a guess, so the login takes over none of them and gets a fresh row,
-- as the session repair does (`siteRowStepOf` in lib/dashboard/site-row.ts).
-- The take-over UPDATE and its foreign-key fallback are the 0079 body,
-- unchanged.
--
-- Additive in effect: the function only matches more spellings of one email.
-- No row, column, table or constraint is dropped, deleted or rewritten, and
-- the trigger is the same one. The UPDATE below is inside the function body,
-- unchanged from drizzle/0079; it runs only when a login is created or
-- changes its id or email.
CREATE OR REPLACE FUNCTION public.sync_auth_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_user_id TEXT;
  email_matches INTEGER;
BEGIN
  SELECT id
  INTO existing_user_id
  FROM public.users
  WHERE id = NEW.id;

  IF existing_user_id IS NULL THEN
    SELECT count(*), min(id)
    INTO email_matches, existing_user_id
    FROM public.users
    WHERE lower(trim(email)) = lower(trim(NEW.email))
      AND deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM better_auth."user" AS login WHERE login.id = public.users.id);

    IF email_matches <> 1 THEN
      existing_user_id := NULL;
    END IF;
  END IF;

  IF existing_user_id IS NULL THEN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW());
  ELSE
    BEGIN
      UPDATE public.users
      SET
        id = NEW.id,
        email = NEW.email,
        updated_at = NOW()
      WHERE id = existing_user_id;
    EXCEPTION WHEN foreign_key_violation THEN
      INSERT INTO public.users (id, email, created_at, updated_at)
      VALUES (NEW.id, NEW.email, NOW(), NOW());
    END;
  END IF;

  RETURN NEW;
END;
$$ SECURITY DEFINER;
