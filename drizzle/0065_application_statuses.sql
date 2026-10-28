-- The application status list (epic #588, issue #748; rulings R1.2 and R1.4
-- on #745). Every application gets one status from a stored list: the ten
-- built-in statuses inserted here, in the ruled order, and the statuses
-- approvers add later under one built-in parent.
-- lib/dashboard/application-status.ts owns the built-in keys, their order and
-- the parent rule.
--
-- Additive only: every preview build applies this to the shared preview
-- database. One new table with its audit trigger and its ten built-in rows,
-- and one new nullable column on `applications` with its foreign key and
-- index. The old `status` column stays and keeps being written; dropping it
-- is a later cleanup. No existing application row is changed: they are test
-- data, and a row with no status reference reads as New.
--
-- Written to apply again over a database that already holds it (as 0039 and
-- 0063 are), so a renumbered copy applies cleanly; a second run keeps the
-- built-in rows as they stand.
CREATE TABLE IF NOT EXISTS "application_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"colour" text NOT NULL,
	"sort_order" integer NOT NULL,
	"parent_key" text,
	CONSTRAINT "application_statuses_key_unique" UNIQUE("key"),
	CONSTRAINT "application_statuses_one_place" UNIQUE NULLS NOT DISTINCT("parent_key","sort_order"),
	CONSTRAINT "application_statuses_built_in_has_no_parent" CHECK (("application_statuses"."key" in ('new', 'interview', 'accepted_email_to_be_sent', 'accepted_email_sent', 'nda_received', 'joined', 'rejected_email_to_be_sent', 'rejected_email_sent', 'accepted_for_another_position', 'withdrawn')) = ("application_statuses"."parent_key" is null)),
	CONSTRAINT "application_statuses_parent_is_built_in" CHECK ("application_statuses"."parent_key" is null or "application_statuses"."parent_key" in ('new', 'interview', 'accepted_email_to_be_sent', 'accepted_email_sent', 'nda_received', 'joined', 'rejected_email_to_be_sent', 'rejected_email_sent', 'accepted_for_another_position', 'withdrawn')),
	CONSTRAINT "application_statuses_colour_hex" CHECK ("application_statuses"."colour" ~ '^#[0-9A-F]{6}$')
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_statuses_parent_key_application_statuses_key_fk') THEN ALTER TABLE "application_statuses" ADD CONSTRAINT "application_statuses_parent_key_application_statuses_key_fk" FOREIGN KEY ("parent_key") REFERENCES "public"."application_statuses"("key") ON DELETE restrict ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.application_statuses FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();--> statement-breakpoint
INSERT INTO "application_statuses" ("key", "name", "colour", "sort_order") VALUES
	('new', 'New', '#8A8A8F', 1),
	('interview', 'Interview', '#FF5E00', 2),
	('accepted_email_to_be_sent', 'Accepted · email to be sent', '#F5A623', 3),
	('accepted_email_sent', 'Accepted · email sent', '#4DA3FF', 4),
	('nda_received', 'NDA received', '#2E9B4F', 5),
	('joined', 'Joined', '#2E9B4F', 6),
	('rejected_email_to_be_sent', 'Rejected · email to be sent', '#CE2B4B', 7),
	('rejected_email_sent', 'Rejected · email sent', '#5E5E64', 8),
	('accepted_for_another_position', 'Accepted for another position', '#5E5E64', 9),
	('withdrawn', 'Withdrawn', '#5E5E64', 10)
	ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "status_key" text;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_status_key_application_statuses_key_fk') THEN ALTER TABLE "applications" ADD CONSTRAINT "applications_status_key_application_statuses_key_fk" FOREIGN KEY ("status_key") REFERENCES "public"."application_statuses"("key") ON DELETE restrict ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_status_key_idx" ON "applications" USING btree ("status_key");
