-- Undo the other test writes made on the shared `preview` database on
-- 2026-10-22 through the preview's test developer sign-in (issue #572), the
-- ones 0052 (#567) does not cover. Owner decision (2026-10-22): none of these
-- writes were the owner's; undo all of them with one data-only migration.
--
-- Audit rows in `logs`, as read on the preview branch:
--
-- 1. Tester Member's alias (member 901), 896-900 and 902: alias_requests 1,
--    asked by the tester division lead and marked created viewed as Andrea
--    Pantano; `email_alias` set on member 901; notices 1 (`alias-created`)
--    and 2 (`alias-ready`); then `email_alias_set_up_at` set on member 901.
-- 2. Beatrice La Motta (member 119), 901: alias_requests 2, still open.
-- 3. Marco Delogu's alias (member 2), 903-907: alias_requests 3, created;
--    `email_alias` set on member 2; notices 3 and 4.
-- 4. Filippo Prosperi (member 140), 914-915: alias_requests 6, asked and
--    cancelled.
-- 5. The tester division lead's alias (member 902), 916-919: alias_requests
--    7, created; `email_alias` set on member 902; notice 6.
-- 6. Tester Member's profile, edited by the tester division lead, 921, 922,
--    924 and 925: `users.polito_id` `s900002` -> `900002`,
--    `users.level_of_study` `Master` -> null (with `users.updated_at`
--    stamped), and `members.prt_email` cleared. Audit rows 920 and 923, from
--    the same saves, rewrote roles 142 with its own values and changed
--    nothing, so there is nothing to undo for them.
--
-- The statements below delete notices 1, 2, 3, 4 and 6, then alias requests
-- 1, 2, 3, 6 and 7, and put members 2, 901 and 902 and Tester Member's
-- `users` row back to the values their audit rows' `old_data` holds.
--
-- Issue #563 (PR #575) adds a migration that copies `email_alias` into an
-- empty `prt_email`. If it runs first, it fills member 901's cleared
-- `prt_email` with the stray alias, so the member 901 statement accepts
-- either that alias or null there and writes the old address back either
-- way. Members 2 and 902 kept their `prt_email`, which that copy leaves
-- alone. The result is the same in either order.
--
-- Data only: no table, column, type, index, constraint or trigger changes.
-- Every statement pins its row by id, by the person through their `users`
-- row, by the exact values the write left, and by the audit row in `logs`
-- that recorded it on 2026-10-22. A database without those rows (production,
-- a fresh local database, a locally seeded one, whose tester alias rows look
-- alike) matches nothing, so the migration is a no-op there. The 2026-10-22
-- audit rows are kept; these statements leave their own audit rows beside
-- them.
DELETE FROM "dashboard_notices" AS n
WHERE n."id" = 1
  AND n."kind" = 'alias-created'
  AND n."recipient_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003' AND u."first_name" = 'Tester' AND u."last_name" = 'Division Lead')
  AND n."subject_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000002' AND u."first_name" = 'Tester' AND u."last_name" = 'Member')
  AND n."data" = '{"address": "tester.member@politorocketteam.it"}'::jsonb
  AND n."created_at" = '2026-10-22 09:27:08.8045+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 899 AND l."table_name" = 'dashboard_notices' AND l."operation" = 'INSERT' AND l."record_id" = '1'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "dashboard_notices" AS n
WHERE n."id" = 2
  AND n."kind" = 'alias-ready'
  AND n."recipient_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000002' AND u."first_name" = 'Tester' AND u."last_name" = 'Member')
  AND n."subject_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000002' AND u."first_name" = 'Tester' AND u."last_name" = 'Member')
  AND n."data" = '{"address": "tester.member@politorocketteam.it"}'::jsonb
  AND n."created_at" = '2026-10-22 09:27:08.8045+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 900 AND l."table_name" = 'dashboard_notices' AND l."operation" = 'INSERT' AND l."record_id" = '2'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "dashboard_notices" AS n
WHERE n."id" = 3
  AND n."kind" = 'alias-created'
  AND n."recipient_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000001' AND u."first_name" = 'Andrea' AND u."last_name" = 'Pantano')
  AND n."subject_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."first_name" = 'Marco' AND u."last_name" = 'Delogu')
  AND n."data" = '{"address": "preview.reviewer@politorocketteam.it"}'::jsonb
  AND n."created_at" = '2026-10-22 09:33:15.956572+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 906 AND l."table_name" = 'dashboard_notices' AND l."operation" = 'INSERT' AND l."record_id" = '3'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "dashboard_notices" AS n
WHERE n."id" = 4
  AND n."kind" = 'alias-ready'
  AND n."recipient_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."first_name" = 'Marco' AND u."last_name" = 'Delogu')
  AND n."subject_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."first_name" = 'Marco' AND u."last_name" = 'Delogu')
  AND n."data" = '{"address": "preview.reviewer@politorocketteam.it"}'::jsonb
  AND n."created_at" = '2026-10-22 09:33:15.956572+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 907 AND l."table_name" = 'dashboard_notices' AND l."operation" = 'INSERT' AND l."record_id" = '4'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "dashboard_notices" AS n
WHERE n."id" = 6
  AND n."kind" = 'alias-created'
  AND n."recipient_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000001' AND u."first_name" = 'Andrea' AND u."last_name" = 'Pantano')
  AND n."subject_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003' AND u."first_name" = 'Tester' AND u."last_name" = 'Division Lead')
  AND n."data" = '{"address": "tester.divisionlead@politorocketteam.it"}'::jsonb
  AND n."created_at" = '2026-10-22 12:08:41.134798+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 919 AND l."table_name" = 'dashboard_notices' AND l."operation" = 'INSERT' AND l."record_id" = '6'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "alias_requests" AS r
WHERE r."id" = 1
  AND r."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000002' AND u."first_name" = 'Tester' AND u."last_name" = 'Member')
  AND r."requested_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003' AND u."first_name" = 'Tester' AND u."last_name" = 'Division Lead')
  AND r."answered_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000001' AND u."first_name" = 'Andrea' AND u."last_name" = 'Pantano')
  AND r."outcome" = 'created'
  AND r."created_at" = '2026-10-22 09:25:21.677914+00'
  AND r."answered_at" = '2026-10-22 09:27:08.785+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 896 AND l."table_name" = 'alias_requests' AND l."operation" = 'INSERT' AND l."record_id" = '1'
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000003'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  )
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 897 AND l."table_name" = 'alias_requests' AND l."operation" = 'UPDATE' AND l."record_id" = '1'
      AND l."new_data" ->> 'outcome' = 'created'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "alias_requests" AS r
WHERE r."id" = 2
  AND r."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000119' AND u."first_name" = 'Beatrice' AND u."last_name" = 'La Motta')
  AND r."requested_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003' AND u."first_name" = 'Tester' AND u."last_name" = 'Division Lead')
  AND r."outcome" IS NULL
  AND r."answered_by" IS NULL
  AND r."answered_at" IS NULL
  AND r."created_at" = '2026-10-22 09:28:40.825501+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 901 AND l."table_name" = 'alias_requests' AND l."operation" = 'INSERT' AND l."record_id" = '2'
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000003'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "alias_requests" AS r
WHERE r."id" = 3
  AND r."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."first_name" = 'Marco' AND u."last_name" = 'Delogu')
  AND r."requested_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000001' AND u."first_name" = 'Andrea' AND u."last_name" = 'Pantano')
  AND r."answered_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000001' AND u."first_name" = 'Andrea' AND u."last_name" = 'Pantano')
  AND r."outcome" = 'created'
  AND r."created_at" = '2026-10-22 09:32:37.114556+00'
  AND r."answered_at" = '2026-10-22 09:33:15.918+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 903 AND l."table_name" = 'alias_requests' AND l."operation" = 'INSERT' AND l."record_id" = '3'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  )
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 904 AND l."table_name" = 'alias_requests' AND l."operation" = 'UPDATE' AND l."record_id" = '3'
      AND l."new_data" ->> 'outcome' = 'created'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "alias_requests" AS r
WHERE r."id" = 6
  AND r."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000140' AND u."first_name" = 'Filippo' AND u."last_name" = 'Prosperi')
  AND r."requested_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003' AND u."first_name" = 'Tester' AND u."last_name" = 'Division Lead')
  AND r."answered_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003' AND u."first_name" = 'Tester' AND u."last_name" = 'Division Lead')
  AND r."outcome" = 'cancelled'
  AND r."created_at" = '2026-10-22 10:53:34.188771+00'
  AND r."answered_at" = '2026-10-22 10:53:34.524+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 914 AND l."table_name" = 'alias_requests' AND l."operation" = 'INSERT' AND l."record_id" = '6'
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000003'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  )
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 915 AND l."table_name" = 'alias_requests' AND l."operation" = 'UPDATE' AND l."record_id" = '6'
      AND l."new_data" ->> 'outcome' = 'cancelled'
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000003'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
DELETE FROM "alias_requests" AS r
WHERE r."id" = 7
  AND r."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003' AND u."first_name" = 'Tester' AND u."last_name" = 'Division Lead')
  AND r."requested_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000001' AND u."first_name" = 'Andrea' AND u."last_name" = 'Pantano')
  AND r."answered_by" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000001' AND u."first_name" = 'Andrea' AND u."last_name" = 'Pantano')
  AND r."outcome" = 'created'
  AND r."created_at" = '2026-10-22 12:08:13.350155+00'
  AND r."answered_at" = '2026-10-22 12:08:41.114+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 916 AND l."table_name" = 'alias_requests' AND l."operation" = 'INSERT' AND l."record_id" = '7'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  )
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 917 AND l."table_name" = 'alias_requests' AND l."operation" = 'UPDATE' AND l."record_id" = '7'
      AND l."new_data" ->> 'outcome' = 'created'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
UPDATE "members" AS m
SET "email_alias" = NULL, "email_alias_set_up_at" = NULL, "prt_email" = 'member.tester@example.com'
WHERE m."member_id" = 901
  AND m."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000002' AND u."first_name" = 'Tester' AND u."last_name" = 'Member')
  AND m."email_alias" = 'tester.member@politorocketteam.it'
  AND m."email_alias_set_up_at" = '2026-10-22 09:31:08.055+00'
  AND (m."prt_email" IS NULL OR m."prt_email" = 'tester.member@politorocketteam.it')
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 898 AND l."table_name" = 'members' AND l."operation" = 'UPDATE' AND l."record_id" = '901'
      AND l."old_data" -> 'email_alias' = 'null'::jsonb AND l."new_data" ->> 'email_alias' = 'tester.member@politorocketteam.it'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  )
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 902 AND l."table_name" = 'members' AND l."operation" = 'UPDATE' AND l."record_id" = '901'
      AND l."old_data" -> 'email_alias_set_up_at' = 'null'::jsonb AND l."new_data" ->> 'email_alias_set_up_at' IS NOT NULL
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000002'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  )
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 922 AND l."table_name" = 'members' AND l."operation" = 'UPDATE' AND l."record_id" = '901'
      AND l."old_data" ->> 'prt_email' = 'member.tester@example.com' AND l."new_data" -> 'prt_email' = 'null'::jsonb
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000003'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
UPDATE "members" AS m
SET "email_alias" = NULL
WHERE m."member_id" = 2
  AND m."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."first_name" = 'Marco' AND u."last_name" = 'Delogu')
  AND m."email_alias" = 'preview.reviewer@politorocketteam.it'
  AND m."email_alias_set_up_at" IS NULL
  AND m."prt_email" = 'marco.delogu@prt.example.com'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 905 AND l."table_name" = 'members' AND l."operation" = 'UPDATE' AND l."record_id" = '2'
      AND l."old_data" -> 'email_alias' = 'null'::jsonb AND l."new_data" ->> 'email_alias' = 'preview.reviewer@politorocketteam.it'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
UPDATE "members" AS m
SET "email_alias" = NULL
WHERE m."member_id" = 902
  AND m."member_id" = (SELECT u."member" FROM "users" AS u WHERE u."id" = '7e57e500-0000-4000-8000-000000000003' AND u."first_name" = 'Tester' AND u."last_name" = 'Division Lead')
  AND m."email_alias" = 'tester.divisionlead@politorocketteam.it'
  AND m."email_alias_set_up_at" IS NULL
  AND m."prt_email" = 'division-lead.tester@example.com'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 918 AND l."table_name" = 'members' AND l."operation" = 'UPDATE' AND l."record_id" = '902'
      AND l."old_data" -> 'email_alias' = 'null'::jsonb AND l."new_data" ->> 'email_alias' = 'tester.divisionlead@politorocketteam.it'
      AND l."changed_by" = '5eed0000-0000-4000-8000-000000000001'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
--> statement-breakpoint
UPDATE "users" AS u
SET "polito_id" = 's900002', "level_of_study" = 'Master', "updated_at" = '2026-10-09 08:00:00+00'
WHERE u."id" = '7e57e500-0000-4000-8000-000000000002'
  AND u."member" = 901
  AND u."first_name" = 'Tester'
  AND u."last_name" = 'Member'
  AND u."polito_id" = '900002'
  AND u."level_of_study" IS NULL
  AND u."updated_at" = '2026-10-22 12:14:08.726698+00'
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 921 AND l."table_name" = 'users' AND l."operation" = 'UPDATE' AND l."record_id" = '7e57e500-0000-4000-8000-000000000002'
      AND l."old_data" ->> 'polito_id' = 's900002' AND l."new_data" ->> 'polito_id' = '900002'
      AND l."old_data" ->> 'level_of_study' = 'Master' AND l."new_data" -> 'level_of_study' = 'null'::jsonb
      AND l."old_data" ->> 'updated_at' = '2026-10-09T08:00:00+00:00'
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000003'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  )
  AND EXISTS (
    SELECT 1 FROM "logs" AS l
    WHERE l."id" = 924 AND l."table_name" = 'users' AND l."operation" = 'UPDATE' AND l."record_id" = '7e57e500-0000-4000-8000-000000000002'
      AND l."new_data" ->> 'polito_id' = '900002' AND l."new_data" -> 'level_of_study' = 'null'::jsonb
      AND l."changed_by" = '7e57e500-0000-4000-8000-000000000003'
      AND l."changed_at" >= '2026-10-22 00:00:00+00' AND l."changed_at" < '2026-10-23 00:00:00+00'
  );
