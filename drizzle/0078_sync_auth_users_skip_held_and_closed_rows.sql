-- A new login takes over only a free, open `users` row (issue #910,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/910). The trigger
-- of drizzle/0001 matched a row by id or by email, and its email match took
-- any row with the address:
--
-- - a row whose id another `better_auth."user"` holds: that login was then
--   left with no row, and its every sign-in ended on "We could not open your
--   account";
-- - a row Delete account closed (`deleted_at` set): giving it the new id
--   fails on the audit log rows the person wrote under the old one, so the
--   same Google account could not sign in again after closing its account.
--
-- The email match now skips both, and the login gets a fresh row instead, as
-- it does when no row has its email. A login matched by its own id is
-- unchanged.
--
-- Additive in effect: the function only refuses a match it made before. A row
-- it still matches is updated exactly as before, and the trigger is the same
-- one, so no row, column or table is dropped, deleted or rewritten. The one
-- UPDATE below is inside the function body, unchanged from drizzle/0001; it
-- runs only when a login is created or changes its id or email.
CREATE OR REPLACE FUNCTION public.sync_auth_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_user_id TEXT;
BEGIN
  SELECT id
  INTO existing_user_id
  FROM public.users
  WHERE id = NEW.id
    OR (
      email = NEW.email
      AND deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM better_auth."user" AS login WHERE login.id = public.users.id)
    )
  ORDER BY CASE WHEN id = NEW.id THEN 0 ELSE 1 END
  LIMIT 1;

  IF existing_user_id IS NULL THEN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW());
  ELSE
    UPDATE public.users
    SET
      id = NEW.id,
      email = NEW.email,
      updated_at = NOW()
    WHERE id = existing_user_id;
  END IF;

  RETURN NEW;
END;
$$ SECURITY DEFINER;
