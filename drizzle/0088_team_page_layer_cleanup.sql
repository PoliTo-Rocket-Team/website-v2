-- The cleanup half of the Team page layout change (issue #855,
-- https://github.com/PoliTo-Rocket-Team/website-v2/issues/855, ADR 0019).
-- Migration 0076 added `team_page_layer_versions.layout` beside the old
-- layer, and a post-migration step filled it; production holds a layout on
-- every row. No code reads the layer's people fields, a row with no layout or
-- `departments.kind` any more, so this drops them. Not additive, by design:
-- lib/seed/additive-migration.test.ts pins every statement here.
--
-- 1. A row with no layout yet is removed: the fill skipped only a layer the
--    page skips anyway, and production holds no such row. A shared preview
--    database may.
-- 2. The layout is required.
-- 3. The layer keeps only its intro text, figures and group photo: the
--    leader edit, spots, added leaders, department edits and added
--    departments leave every row that still holds one.
-- 4. The department kind leaves the team record; department groups on the
--    Team page layout hold it (amendment of 2026-10-31 on #855).
--
-- Written to apply again over a database that already holds it.
DELETE FROM "team_page_layer_versions" WHERE "layout" IS NULL;
--> statement-breakpoint
ALTER TABLE "team_page_layer_versions" ALTER COLUMN "layout" SET NOT NULL;
--> statement-breakpoint
UPDATE "team_page_layer_versions" SET "layer" = "layer" - 'leader' - 'spots' - 'addedLeaders' - 'departments' - 'addedDepartments' WHERE "layer" <> "layer" - 'leader' - 'spots' - 'addedLeaders' - 'departments' - 'addedDepartments';
--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN IF EXISTS "kind";
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."department_kind";
