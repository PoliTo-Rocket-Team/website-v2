-- Undo two writes a UI reviewer made on the shared `preview` database on
-- 2026-10-22, while checking the email alias screens for #550 (PR #557),
-- through the preview's test developer sign-in (issue #567).
-- Owner decision (2026-10-22): undo both writes with a migration.
--
-- Write 1, 10:52:32 UTC, one division save viewed as Marco Delogu
-- (audit rows 909, 910, 911): Stefano Motta's existing Test Bench role
-- (roles 120) went from `core` to `lead`; the same save renamed the Test
-- Bench division (divisions 1) to "Test Bench Division", because a division
-- save writes the name with the leads (writeDivisionPlan in
-- lib/dashboard/database-team.ts); and it inserted the automatic alias
-- request for the new lead (alias_requests 5, `requested_by` null, issue
-- #543). It wrote no notice. This puts the role and the name back and
-- removes the request.
--
-- Write 2, 10:49:48 and 10:53:14 UTC (audit rows 908, 912, 913): an alias
-- request for Dimitri Mazzone (alias_requests 4), asked by the tester
-- division lead and declined by the tester operations lead, and the
-- `alias-declined` notice the decline sent (dashboard_notices 5). This
-- removes both.
--
-- Data only: no table, column, type, index, constraint or trigger changes.
-- Every statement pins its row by id, by the person through their `users`
-- row, by the exact values that write left, and by the audit row in `logs`
-- that recorded it. A database without those rows (production, a fresh local
-- database, a re-seeded preview) matches nothing, so the migration is a
-- no-op there. The reviewer's audit rows are kept; these statements leave
-- their own audit rows beside them.
DELETE FROM "dashboard_notices" AS n
WHERE n."id" = 5
  AND n."kind" = 'alias-declined'
  AND n."subject_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000134' AND u."first_name" = 'Dimitri' AND u."last_name" = 'Mazzone')
  AND n."recipient_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003')
  AND n."data" = '{"by": "Tester Operations Lead"}'::jsonb
  AND n."created_at" = '2026-10-22 10:53:14.025339+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 913 AND l."table_name" = 'dashboard_notices' AND l."operation" = 'INSERT' AND l."record_id" = '5'
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000004'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "alias_requests" AS r
WHERE r."id" = 4
  AND r."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000134' AND u."first_name" = 'Dimitri' AND u."last_name" = 'Mazzone')
  AND r."requested_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003')
  AND r."answered_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000004')
  AND r."outcome" = 'declined'
  AND r."created_at" = '2026-10-22 10:49:48.950421+00'
  AND r."answered_at" = '2026-10-22 10:53:13.999+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 912 AND l."table_name" = 'alias_requests' AND l."operation" = 'UPDATE' AND l."record_id" = '4'
      AND l."new_data" ->> 'outcome' = 'declined'
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000004'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "alias_requests" AS r
WHERE r."id" = 5
  AND r."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000195' AND u."first_name" = 'Stefano' AND u."last_name" = 'Motta')
  AND r."requested_by" IS NULL
  AND r."outcome" IS NULL
  AND r."created_at" = '2026-10-22 10:52:32.173755+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 911 AND l."table_name" = 'alias_requests' AND l."operation" = 'INSERT' AND l."record_id" = '5'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000002'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
UPDATE "roles" AS ro
SET "type" = 'core'
WHERE ro."id" = 120
  AND ro."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000195' AND u."first_name" = 'Stefano' AND u."last_name" = 'Motta')
  AND ro."division_id" = (SELECT d."id" FROM "divisions" AS d WHERE d."id" = 1 AND d."code" = 'TBE')
  AND ro."dept_id" = 1
  AND ro."type" = 'lead'
  AND ro."title" = 'Test Engineer'
  AND ro."started_at" = '2025-10-01'
  AND ro."leaved_at" IS NULL
  AND ro."full_access" IS NULL
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 910 AND l."table_name" = 'roles' AND l."operation" = 'UPDATE' AND l."record_id" = '120'
      AND l."old_data" ->> 'type' = 'core' AND l."new_data" ->> 'type' = 'lead'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000002'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
UPDATE "divisions" AS d
SET "name" = 'Test Bench'
WHERE d."id" = 1
  AND d."code" = 'TBE'
  AND d."name" = 'Test Bench Division'
  AND d."dept_id" = 1
  AND d."started_at" = '2022-09-01'
  AND d."closed_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "roles" AS ro JOIN "users" AS u ON u."member" = ro."member_id"
    WHERE ro."id" = 120 AND ro."division_id" = d."id"
      AND u."id" = '5eed0000-0000-4000-8000-000000000195' AND u."first_name" = 'Stefano' AND u."last_name" = 'Motta'
  )
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 909 AND l."table_name" = 'divisions' AND l."operation" = 'UPDATE' AND l."record_id" = '1'
      AND l."old_data" ->> 'name' = 'Test Bench' AND l."new_data" ->> 'name' = 'Test Bench Division'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000002'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
