-- The recruitment switch's one row, on by default (issue #119), and the
-- audit trigger 0002 attached to every table that existed then: a table
-- created later gets none unless its migration adds it, and the dashboard
-- switch (#121) must be logged.
DROP TRIGGER IF EXISTS audit_row_changes ON public.recruitment_setting;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.recruitment_setting FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
INSERT INTO public.recruitment_setting (id, is_open) VALUES (true, true) ON CONFLICT (id) DO NOTHING;
