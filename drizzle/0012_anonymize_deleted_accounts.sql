ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "anonymized_at" timestamp with time zone;--> statement-breakpoint
-- Backfill (issue #191): an account closed before this migration gets the time
-- its Better Auth user was deleted, read off the audit log. A users row with no
-- such log row keeps a null deleted_at, even with no Better Auth user: legacy
-- rows from the old site never had a sign-in and were never deleted.
UPDATE "users" AS u
SET "deleted_at" = d.deleted_at
FROM (
  SELECT "record_id", max("changed_at") AS deleted_at
  FROM "logs"
  WHERE "schema_name" = 'better_auth'
    AND "table_name" = 'user'
    AND "operation" = 'DELETE'
    AND "record_id" IS NOT NULL
  GROUP BY "record_id"
) AS d
WHERE d."record_id" = u."id"
  AND u."deleted_at" IS NULL;
