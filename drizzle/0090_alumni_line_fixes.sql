-- Where and how the Alumni page shows each year row (issue #1006,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/1006). The fix panel
-- on the dashboard's Alumni page can now move a year row to another academic
-- year or another department or division, and set how the page marks the
-- person that year: Member, Lead or Head. A row from the team record keeps
-- that fix in the new `alumni_line_fixes` table, keyed like
-- `alumni_role_fixes` by the year and group the record gives the row; a year
-- added on the page keeps its mark in the new `mark` column of
-- `alumni_added_years`. Neither writes a role, a date or a division.
--
-- Expand only: one new table with its index, its constraints and its audit
-- trigger, and one new nullable column with its check. Nothing is dropped,
-- renamed, filled or rewritten, so the older preview code that reads the
-- shared preview database while this runs reads the same rows.
--
-- Safe to run again: the table, index, column and check are made only when
-- missing, and the trigger is replaced.
CREATE TABLE IF NOT EXISTS "alumni_line_fixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL REFERENCES "public"."alumni_entries"("id") ON DELETE cascade ON UPDATE no action,
	"year" integer NOT NULL,
	"group_name" text NOT NULL,
	"to_year" integer,
	"to_department_id" integer REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action,
	"to_division_id" integer REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action,
	"mark" text,
	CONSTRAINT "alumni_line_fixes_one_unit" CHECK (num_nonnulls("to_department_id", "to_division_id") <= 1),
	CONSTRAINT "alumni_line_fixes_mark" CHECK ("mark" is null or "mark" in ('member', 'lead', 'head')),
	CONSTRAINT "alumni_line_fixes_changes" CHECK (num_nonnulls("to_year", "to_department_id", "to_division_id", "mark") >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alumni_line_fixes_line" ON "alumni_line_fixes" USING btree ("entry_id", "year", "group_name");
--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.alumni_line_fixes FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
--> statement-breakpoint
ALTER TABLE "alumni_added_years" ADD COLUMN IF NOT EXISTS "mark" text;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alumni_added_years_mark') THEN ALTER TABLE "alumni_added_years" ADD CONSTRAINT "alumni_added_years_mark" CHECK ("mark" is null or "mark" in ('member', 'lead', 'head')); END IF; END $$;
