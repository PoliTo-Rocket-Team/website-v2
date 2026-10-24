-- R&D is a department with a head and no divisions (Owner decisions of
-- 2026-10-24 on issues #627 and #600). The Head of R&D's role was stored as a
-- role in no department and no division, so the dashboard read it as a
-- team-level seat. This attaches that role to the R&D department as its head.
-- The guarded UPDATE below is the one data move the Owner decision on #600
-- allows: https://github.com/PoliTo-Rocket-Team/website-v2/issues/600#issuecomment-6385783494
-- and https://github.com/PoliTo-Rocket-Team/website-v2/issues/600#issuecomment-6385921817
--
-- The R&D department is an open department coded RND, or named "R&D" or
-- "Research and Development"; where several match, the lowest id.
-- The Head of R&D's role is an active core role with no full-access flag, in
-- no department and no division, titled exactly "Head of R&D"; where several
-- match, the oldest.
--
-- 1. A department "Research and Development" is added only when that role
--    exists and no R&D department is open, so there is never a second one.
--    Its code is RND unless an open department already uses it.
-- 2. That role becomes the R&D department's head only when the department
--    has no active head, so no department gets two heads. Its title, holder
--    and start date stay; only its type and department change.
--
-- Data only, and safe to run again: no table, column, type, index, constraint
-- or trigger changes, and nothing is dropped or deleted. A database without
-- that role matches nothing, and a second run finds the role already placed.
-- An R&D department that already has a head is left alone, and so is the role.
-- No other role or department is touched.
INSERT INTO "departments" ("name", "started_at", "code", "kind")
SELECT
  'Research and Development',
  r."started_at",
  CASE WHEN EXISTS (SELECT 1 FROM "departments" AS d WHERE d."closed_at" IS NULL AND upper(trim(d."code")) = 'RND') THEN NULL ELSE 'RND' END,
  'technical'
FROM "roles" AS r
WHERE r."leaved_at" IS NULL
  AND r."dept_id" IS NULL
  AND r."division_id" IS NULL
  AND r."type" = 'core'
  AND r."full_access" IS NULL
  AND r."title" = 'Head of R&D'
  AND NOT EXISTS (
    SELECT 1 FROM "departments" AS d
    WHERE d."closed_at" IS NULL AND (upper(trim(d."code")) = 'RND' OR d."name" IN ('R&D', 'Research and Development'))
  )
ORDER BY r."started_at", r."id"
LIMIT 1;
--> statement-breakpoint
UPDATE "roles" AS r
SET "type" = 'head',
  "dept_id" = (
    SELECT d."id" FROM "departments" AS d
    WHERE d."closed_at" IS NULL AND (upper(trim(d."code")) = 'RND' OR d."name" IN ('R&D', 'Research and Development'))
    ORDER BY d."id" LIMIT 1
  )
WHERE r."leaved_at" IS NULL
  AND r."dept_id" IS NULL
  AND r."division_id" IS NULL
  AND r."type" = 'core'
  AND r."full_access" IS NULL
  AND r."title" = 'Head of R&D'
  AND r."id" = (
    SELECT s."id" FROM "roles" AS s
    WHERE s."leaved_at" IS NULL AND s."dept_id" IS NULL AND s."division_id" IS NULL AND s."type" = 'core' AND s."full_access" IS NULL AND s."title" = 'Head of R&D'
    ORDER BY s."started_at", s."id" LIMIT 1
  )
  AND EXISTS (
    SELECT 1 FROM "departments" AS d
    WHERE d."closed_at" IS NULL AND (upper(trim(d."code")) = 'RND' OR d."name" IN ('R&D', 'Research and Development'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "roles" AS h
    WHERE h."leaved_at" IS NULL
      AND h."type" = 'head'
      AND h."division_id" IS NULL
      AND h."dept_id" = (
        SELECT d."id" FROM "departments" AS d
        WHERE d."closed_at" IS NULL AND (upper(trim(d."code")) = 'RND' OR d."name" IN ('R&D', 'Research and Development'))
        ORDER BY d."id" LIMIT 1
      )
  );
