-- A first sign-in never fails on a take-over the database refuses (issue
-- #917, https://github.com/PoliTo-Rocket-Team/website-v2/issues/917). The
-- trigger of drizzle/0078 gives a free, open `users` row with the login's
-- email the login's id. `applications.user_id`, `application_files.user_id`
-- and `logs.changed_by` reference `users.id` with no ON UPDATE CASCADE, so
-- when any of their rows points at that row the UPDATE raises
-- foreign_key_violation, the `better_auth."user"` insert fails with it, and
-- the login cannot be created.
--
-- The UPDATE now runs in its own block. When the database refuses it for a
-- foreign key, the block is rolled back, the matched row and every row that
-- points at it are left exactly as they were, and the login gets a fresh row
-- instead, id and email only, as it does when no row has its email. This is
-- the same fallback the session repair takes (lib/dashboard/database-site-row.ts,
-- issue #910). Every other path is the 0078 body, unchanged.
--
-- Additive in effect: the function only replaces a failure with a fresh row.
-- No row, column, table or constraint is dropped, deleted or rewritten, and
-- the trigger is the same one. The UPDATE below is inside the function body,
-- unchanged from drizzle/0078; it runs only when a login is created or
-- changes its id or email.
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
