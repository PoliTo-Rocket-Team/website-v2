-- Restore division names the dashboard's division save renamed by adding
-- " Division" (issue #938). Until #938, New division and every Edit division
-- save stored `<name> Division`, while the field the editor typed in always
-- removed a typed "Division". So a suffix on a name that save wrote came
-- from the code, never from the editor. Every other reader treats the stored
-- name as having no suffix, and the Apply page adds its own.
--
-- Data only: no table, column, type, index, constraint or trigger changes.
-- A division is repaired only when its last name-changing audit row in
-- `logs` (the audit trigger logs every write, see drizzle/0002 and 0061):
-- - is an app write: `changed_by` names a signed-in user (drizzle/0003 keeps
--   only a known user there; a migration, seed or import write logs none);
-- - wrote a name ending in " Division": an INSERT (New division), or an
--   UPDATE whose new name is exactly the old name plus " Division";
-- - and the division's current name is still that logged name, so a later
--   rename wins.
-- Names written by seeds, imports or by hand, and names with no such row,
-- stay as they are. The repair logs its own audit row with no user, which
-- becomes the division's last name-changing row, so a second run, or a run
-- on a database that never had the problem, changes nothing.
UPDATE "divisions" AS d
SET "name" = left(d."name", length(d."name") - length(' Division'))
FROM (
  SELECT DISTINCT ON (l."record_id") l."record_id", l."operation", l."old_data", l."new_data", l."changed_by"
  FROM "logs" AS l
  WHERE l."schema_name" = 'public'
    AND l."table_name" = 'divisions'
    AND (
      l."operation" = 'INSERT'
      OR (l."operation" = 'UPDATE' AND (l."new_data" ->> 'name') IS DISTINCT FROM (l."old_data" ->> 'name'))
    )
  ORDER BY l."record_id", l."changed_at" DESC, l."id" DESC
) AS last
WHERE last."record_id" = d."id"::text
  AND last."changed_by" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "users" AS u WHERE u."id" = last."changed_by")
  AND (last."new_data" ->> 'name') LIKE '% Division'
  AND (
    last."operation" = 'INSERT'
    OR (last."new_data" ->> 'name') = (last."old_data" ->> 'name') || ' Division'
  )
  AND d."name" = (last."new_data" ->> 'name');
