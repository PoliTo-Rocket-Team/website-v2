-- The audit trigger 0002 attached to every table that existed then, on the
-- table 0012 creates (issue #201): a table created later gets none unless its
-- migration adds it, and who wrote or dismissed a notice must be logged.
DROP TRIGGER IF EXISTS audit_row_changes ON public.dashboard_notices;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.dashboard_notices FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
