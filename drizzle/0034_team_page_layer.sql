CREATE TABLE "team_page_layer_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" "content_version" NOT NULL,
	"layer" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_page_layer_versions_version_unique" UNIQUE("version")
);

--> statement-breakpoint
-- The audit trigger 0002 attached to every table that existed then, on the
-- table above (issue #283): a table created later gets none unless its
-- migration adds it, and who saved, published or reset the Team page's
-- visual layer must be logged.
DROP TRIGGER IF EXISTS audit_row_changes ON public.team_page_layer_versions;
--> statement-breakpoint
CREATE TRIGGER audit_row_changes AFTER INSERT OR UPDATE OR DELETE ON public.team_page_layer_versions FOR EACH ROW EXECUTE FUNCTION public.log_db_changes();
