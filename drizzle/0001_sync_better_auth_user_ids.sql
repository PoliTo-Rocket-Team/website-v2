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
  WHERE id = NEW.id OR email = NEW.email
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
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_better_auth_user_created ON better_auth."user";
--> statement-breakpoint

CREATE TRIGGER sync_public_users_from_better_auth_user
AFTER INSERT OR UPDATE OF id, email ON better_auth."user"
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_users();
