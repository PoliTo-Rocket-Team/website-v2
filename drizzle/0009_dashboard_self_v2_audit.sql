-- The audit trigger 0002 attached to every table that existed then, on the
-- two tables 0008 creates (issue #169): a table created later gets none unless
-- its migration adds it, and the applicant's slot pick and a member leaving
-- must be logged.
DROP TRIGGER IF EXISTS audit_row_changes ON public.interview_slots;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.interview_slots FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_row_changes ON public.team_leaves;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.team_leaves FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
