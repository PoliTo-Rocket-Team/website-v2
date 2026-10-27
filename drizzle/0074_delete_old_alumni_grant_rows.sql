-- Deletes the old Alumni grant rows from `scopes` (issue #637): every row with
-- `scope = 'website'` and `target <> 'content'` (the former Alumni grant,
-- stored on `all`). Issue #589 folded the Alumni grant into the Content grant,
-- and 0058_alumni_grants_to_content gave each holder of an old row a Content
-- grant but deleted nothing. No code reads or writes these rows any more.
--
-- First 0058's guarded insert runs again, unchanged, so a member who still
-- holds only an old row gets their Content grant (a `website` row on
-- `content` at `edit`) before the delete; where 0058 already ran it inserts
-- nothing. Then the delete. `website` rows on `content`, at any level, stay.
-- These two statements are the only ones here, and
-- lib/seed/delete-old-alumni-grant-rows.test.ts pins them.
INSERT INTO "scopes" ("member_id", "given_by", "scope", "target", "access_level")
SELECT DISTINCT ON (old."member_id") old."member_id", old."given_by", 'website'::"scope_type", 'content'::"target_type", 'edit'::"access_level_type"
FROM "scopes" old
WHERE old."scope" = 'website' AND old."target" <> 'content' AND old."member_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "scopes" held WHERE held."member_id" = old."member_id" AND held."scope" = 'website' AND held."target" = 'content'
  )
ORDER BY old."member_id", old."id";
--> statement-breakpoint
DELETE FROM "scopes" WHERE "scope" = 'website' AND "target" <> 'content';
