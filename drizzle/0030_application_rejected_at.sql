-- When an application was rejected, or another team took the person (issue
-- #317). The applicant's own pages list an application until one month after
-- its latest decision; `accepted_at`, `joined_at` and `withdrawn_at` already
-- hold the other decisions' times. Rows decided before this column existed
-- keep it null, and the rule reads them as past the month: no back-fill.
ALTER TABLE "applications" ADD COLUMN "rejected_at" timestamp with time zone;
