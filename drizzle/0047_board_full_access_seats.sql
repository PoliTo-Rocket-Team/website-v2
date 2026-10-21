-- The Project Manager and the Chief Engineer become full-access seats, like
-- the operations lead and the IT lead (Owner decision, 2026-10-21, issue
-- #485). Access follows the role: the flag sits on the seat's role row, so
-- ending the role ends the access. The code reads only the flag; this
-- migration matches the titles once, to mark today's two board roles.
--
-- Postgres refuses to use an enum value added by `ALTER TYPE ... ADD VALUE`
-- before that transaction commits, and the migrator runs every pending
-- migration in one transaction. So the type is rebuilt with all four values
-- and the column recast to it; the new type's values are usable at once.
ALTER TYPE "public"."full_access_seat" RENAME TO "full_access_seat_old";--> statement-breakpoint
CREATE TYPE "public"."full_access_seat" AS ENUM('operations_lead', 'it_lead', 'project_manager', 'chief_engineer');--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "full_access" SET DATA TYPE "public"."full_access_seat" USING "full_access"::text::"public"."full_access_seat";--> statement-breakpoint
DROP TYPE "public"."full_access_seat_old";--> statement-breakpoint
-- The active board roles: in no department or division, not the team
-- leader's, titled exactly by the seat, and not already flagged.
UPDATE "roles"
SET "full_access" = CASE "title"
  WHEN 'Project Manager' THEN 'project_manager'::"public"."full_access_seat"
  WHEN 'Chief Engineer' THEN 'chief_engineer'::"public"."full_access_seat"
END
WHERE "leaved_at" IS NULL
  AND "dept_id" IS NULL
  AND "division_id" IS NULL
  AND "type" IS DISTINCT FROM 'president'
  AND "full_access" IS NULL
  AND "title" IN ('Project Manager', 'Chief Engineer');
