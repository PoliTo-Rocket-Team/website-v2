-- A hand-over request lapses when its sender's roles change before the next
-- level up answers it (issue #262): removed as lead, a division or department
-- closed, made a head, or any other role change. A request is for the roles
-- its sender held when they sent it, so a lapsed one is closed for good: it
-- never blocks their next "Send for confirmation" and never comes back with
-- its old successor. A request already answered is left alone, so Confirm's
-- own role writes close nothing. lib/dashboard/hand-over-request.ts states
-- the same rule (`hasLapsed`, `lapsedBy`), and the dummy data closes them on
-- every save.
ALTER TYPE "public"."hand_over_decision" ADD VALUE 'lapsed';--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.lapse_hand_over_requests() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  changed integer[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    changed := ARRAY[NEW.member_id];
  ELSIF TG_OP = 'DELETE' THEN
    changed := ARRAY[OLD.member_id];
  ELSE
    changed := ARRAY[OLD.member_id, NEW.member_id];
  END IF;
  UPDATE public.hand_over_requests
     SET decision = 'lapsed', decided_by = NULL, decided_at = now()
   WHERE decision IS NULL
     AND from_id = ANY (changed);
  RETURN NULL;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS lapse_hand_over_requests ON public.roles;--> statement-breakpoint
CREATE TRIGGER lapse_hand_over_requests AFTER INSERT OR DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.lapse_hand_over_requests();--> statement-breakpoint
-- A title edit changes no role, so only the columns that say which role it is
-- and whether it is held close a request.
DROP TRIGGER IF EXISTS lapse_hand_over_requests_on_change ON public.roles;--> statement-breakpoint
CREATE TRIGGER lapse_hand_over_requests_on_change AFTER UPDATE ON public.roles FOR EACH ROW
  WHEN (
    OLD.member_id IS DISTINCT FROM NEW.member_id
    OR OLD.type IS DISTINCT FROM NEW.type
    OR OLD.division_id IS DISTINCT FROM NEW.division_id
    OR OLD.dept_id IS DISTINCT FROM NEW.dept_id
    OR OLD.leaved_at IS DISTINCT FROM NEW.leaved_at
  )
  EXECUTE FUNCTION public.lapse_hand_over_requests();
