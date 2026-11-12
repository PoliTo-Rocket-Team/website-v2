-- Years added for the Alumni page only (issue #981,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/981). The fix panel
-- on the dashboard's Alumni page can add a year the team record lacks (an
-- early year that was never imported): the academic year, the department or
-- division, and the title. It lists the person on the public Alumni page in
-- that unit that year and never writes a role, a date or a division. Removing
-- the person's alumni entry, or the unit, removes the row with it.
--
-- Expand only: one new table with its index, its constraints and its audit
-- trigger. Nothing is dropped, renamed, filled or rewritten, so the older
-- preview code that reads the shared preview database while this runs reads
-- the same rows.
--
-- Safe to run again: the table and index are made only when missing, and the
-- trigger is replaced.
CREATE TABLE IF NOT EXISTS "alumni_added_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL REFERENCES "public"."alumni_entries"("id") ON DELETE cascade ON UPDATE no action,
	"year" integer NOT NULL,
	"department_id" integer REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action,
	"division_id" integer REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action,
	"role" text NOT NULL,
	CONSTRAINT "alumni_added_years_one_unit" CHECK (num_nonnulls("department_id", "division_id") = 1)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alumni_added_years_entry_idx" ON "alumni_added_years" USING btree ("entry_id");
--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.alumni_added_years FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
