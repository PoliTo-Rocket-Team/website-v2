-- Orders show the whole team (issue #233). Each order stores the division it
-- was made for, so a person in several divisions (#229) leaves no doubt whose
-- order it is; existing orders take their requester's division: the oldest
-- active one they lead, else their oldest active membership, else the oldest
-- role they ever held in a division. "Approve orders" is a team-wide grant
-- the team leader gives: a `scopes` row with scope `team` and target
-- `approve_orders`, in no department and no division.
ALTER TYPE "public"."scope_type" ADD VALUE 'team';--> statement-breakpoint
ALTER TYPE "public"."target_type" ADD VALUE 'approve_orders';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "division_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_division_id_idx" ON "orders" USING btree ("division_id");--> statement-breakpoint
UPDATE "orders" SET "division_id" = (
  SELECT r."division_id"
  FROM "roles" r
  WHERE r."member_id" = "orders"."requester" AND r."division_id" IS NOT NULL
  ORDER BY (r."leaved_at" IS NOT NULL), COALESCE(r."type" IN ('lead', 'head'), false) DESC, r."started_at", r."id"
  LIMIT 1
)
WHERE "division_id" IS NULL;--> statement-breakpoint
-- The new values are compared as text: an enum value added in this
-- transaction cannot be used as that enum until it commits.
ALTER TABLE "scopes" DROP CONSTRAINT "scopes_structure_constraints";--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_structure_constraints" CHECK (
  ("scope" = 'admin' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope" = 'org' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope" = 'department' AND "dept_id" IS NOT NULL AND "division_id" IS NULL) OR
  ("scope" = 'division' AND "division_id" IS NOT NULL AND "dept_id" IS NULL) OR
  ("scope" = 'website' AND "dept_id" IS NULL AND "division_id" IS NULL) OR
  ("scope"::text = 'team' AND "target"::text = 'approve_orders' AND "dept_id" IS NULL AND "division_id" IS NULL)
);
