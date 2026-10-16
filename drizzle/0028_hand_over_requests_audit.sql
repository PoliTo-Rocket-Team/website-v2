-- The audit trigger 0002 attached to every table that existed then, on the
-- table 0027 creates (issue #262): a table created later gets none unless its
-- migration adds it, and who sent, confirmed or declined a hand-over must be
-- logged.
DROP TRIGGER IF EXISTS audit_row_changes ON public.hand_over_requests;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.hand_over_requests FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
