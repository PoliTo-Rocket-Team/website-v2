-- R&D is a department with a head and no divisions or members (Owner
-- decision of 2026-10-24 on issue #627). The Head of R&D's role was stored as
-- a role in no department and no division, so the dashboard read it as a
-- team-level seat. This places that role under an R&D department, so the
-- Team tree and Edit team tree draw an R&D department box with its head.
--
-- Data only, and safe to run again: no table, column, type, index, constraint
-- or trigger changes, and nothing is dropped or deleted.
-- 1. An open R&D department is added, only where the Head of R&D's role is
--    in no department and no division and no open department is named R&D.
--    Its code is RD unless an open department already uses it.
-- 2. That role (active, in no department and no division, a core role with
--    no full-access flag, titled exactly "Head of R&D") becomes the head role
--    of the open R&D department. Its title, holder and start date stay.
-- A database without that role (production without it, a fresh local
-- database) matches nothing in either statement, and a second run finds the
-- role already placed. No other role or department is touched.
INSERT INTO "departments" ("name", "started_at", "code", "kind")
SELECT
  'R&D',
  r."started_at",
  CASE WHEN EXISTS (SELECT 1 FROM "departments" AS d WHERE d."closed_at" IS NULL AND upper(trim(d."code")) = 'RD') THEN NULL ELSE 'RD' END,
  'technical'
FROM "roles" AS r
WHERE r."leaved_at" IS NULL
  AND r."dept_id" IS NULL
  AND r."division_id" IS NULL
  AND r."type" = 'core'
  AND r."full_access" IS NULL
  AND r."title" = 'Head of R&D'
  AND NOT EXISTS (SELECT 1 FROM "departments" AS d WHERE d."closed_at" IS NULL AND d."name" = 'R&D')
ORDER BY r."started_at", r."id"
LIMIT 1;
--> statement-breakpoint
UPDATE "roles" AS r
SET "type" = 'head',
  "dept_id" = (SELECT d."id" FROM "departments" AS d WHERE d."closed_at" IS NULL AND d."name" = 'R&D' ORDER BY d."id" LIMIT 1)
WHERE r."leaved_at" IS NULL
  AND r."dept_id" IS NULL
  AND r."division_id" IS NULL
  AND r."type" = 'core'
  AND r."full_access" IS NULL
  AND r."title" = 'Head of R&D'
  AND EXISTS (SELECT 1 FROM "departments" AS d WHERE d."closed_at" IS NULL AND d."name" = 'R&D');
