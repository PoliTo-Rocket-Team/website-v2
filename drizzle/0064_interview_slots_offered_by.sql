-- Interview times record who offered them (issue #652): the Overview's
-- upcoming interviews read "with <name>" under each time (board 99b).
-- Move to interview and Change times write the signed-in account here.
--
-- Additive only: every preview build applies this to the shared preview
-- database. The column is new and nullable, and the constraint names only
-- it, so no existing row or column changes. Times stored before this keep a
-- null setter and show no name until they are offered again.
ALTER TABLE "interview_slots" ADD COLUMN IF NOT EXISTS "offered_by" text;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interview_slots_offered_by_users_id_fk') THEN ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_offered_by_users_id_fk" FOREIGN KEY ("offered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade; END IF; END $$;
