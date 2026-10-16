-- The team leader's Orders and Access pages (issue #247). An approved order
-- is marked `ordered` once it is placed with the shop; only Mark as ordered
-- moves it there, and only from `accepted`. A `team` scope row, which held
-- only "Approve orders", may now hold an area given across the whole team:
-- Positions, Applications, Members or Orders, in no department and no
-- division. Alumni access stays the `website` row it was (#234).
ALTER TYPE "public"."status" ADD VALUE 'ordered';--> statement-breakpoint
-- The values are compared as text, as drizzle/0017 does.
ALTER TABLE "scopes" DROP CONSTRAINT "scopes_structure_constraints";--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_structure_constraints" CHECK (
  ("scope" = 'admin' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope" = 'org' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope" = 'department' AND "dept_id" IS NOT NULL AND "division_id" IS NULL) OR
  ("scope" = 'division' AND "division_id" IS NOT NULL AND "dept_id" IS NULL) OR
  ("scope" = 'website' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope"::text = 'team'
    AND "target"::text IN ('approve_orders', 'positions', 'applications', 'members', 'orders')
    AND "dept_id" IS NULL AND "division_id" IS NULL)
);
