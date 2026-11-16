-- The Access page gives a Team tree grant (Owner decision, 2026-11-16, issue
-- #1005): on a division, a department or the whole team, at Can view or Can
-- edit. At Can edit it lets its holder edit the Team tree's structure there,
-- as that unit's lead or head may, and nothing else. It is a `scopes` row on
-- this new target `team_tree`. Additive only: no row is added or changed, so
-- nobody holds it until someone gives it on the Access page.
ALTER TYPE "public"."target_type" ADD VALUE 'team_tree';--> statement-breakpoint
-- A whole-team row may now name `team_tree` too; the check only widens, so
-- every stored row still passes it. The values are compared as text, as
-- drizzle/0017 and drizzle/0019 do.
ALTER TABLE "scopes" DROP CONSTRAINT "scopes_structure_constraints";--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_structure_constraints" CHECK (
  ("scope" = 'admin' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope" = 'org' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope" = 'department' AND "dept_id" IS NOT NULL AND "division_id" IS NULL) OR
  ("scope" = 'division' AND "division_id" IS NOT NULL AND "dept_id" IS NULL) OR
  ("scope" = 'website' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope"::text = 'team'
    AND "target"::text IN ('approve_orders', 'positions', 'applications', 'members', 'orders', 'team_tree')
    AND "dept_id" IS NULL AND "division_id" IS NULL)
);
