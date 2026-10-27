-- Drops `project_versions.content` and its check
-- `project_versions_content_is_record` (issue #535), the second of two steps
-- that make `page` the only stored record of a project.
--
-- `content` held each version's record from before page blocks. Migration
-- 0050 copied it into `page` and 0072_project_page_backfill copied it on every
-- row still without one, so `page` holds everything `content` held except the
-- retired `teaser` key, and is required. No code reads or writes `content`
-- any more: the site, the dashboard and the seed read and write `page` only
-- (lib/project-content/row.ts). These two statements are the only ones here,
-- and lib/seed/additive-migration.test.ts pins them.
ALTER TABLE "project_versions" DROP CONSTRAINT IF EXISTS "project_versions_content_is_record";
--> statement-breakpoint
ALTER TABLE "project_versions" DROP COLUMN IF EXISTS "content";
