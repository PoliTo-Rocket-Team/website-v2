ALTER TYPE "public"."application_status" ADD VALUE 'interview';--> statement-breakpoint
ALTER TYPE "public"."application_status" ADD VALUE 'joined';--> statement-breakpoint
CREATE TABLE "interview_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"chosen" boolean DEFAULT false NOT NULL,
	"chosen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "nda_arrived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "joined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_slots_application_idx" ON "interview_slots" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_slots_one_chosen" ON "interview_slots" USING btree ("application_id") WHERE "interview_slots"."chosen";--> statement-breakpoint
-- Added by hand after the generated statements above: the audit trigger 0002
-- attached to every table that existed then, so a table created later gets
-- none unless its migration adds it (.patterns/schema-migrations.md). The
-- interview times a lead offers are logged like every other recruitment write.
DROP TRIGGER IF EXISTS audit_row_changes ON public.interview_slots;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.interview_slots FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
