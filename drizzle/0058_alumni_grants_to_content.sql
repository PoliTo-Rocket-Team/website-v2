-- The Alumni page is site content (Owner decision, 2026-10-22, issue #589,
-- replacing the separate Alumni grant of #504): a Content grant opens it with
-- the other content editors, and the Access page gives no Alumni area. So that
-- nobody loses access, each member who holds a `website` row on any target but
-- `content`, at any level (the old Alumni grant, stored on `all`), and holds no
-- `website` row on `content` yet, gets a Content grant: a `website` row on
-- `content` at `edit`, the only level Content has. It keeps the giver of their
-- earliest old row.
--
-- Data only, and additive: it inserts rows and changes nothing else. The old
-- `website` rows stay where they are; no code reads them any more, and a later
-- cleanup drops them. A second run inserts nothing, because each member it
-- would add a row for now holds one on `content`. Every preview build applies
-- this to the shared preview database before merge.
INSERT INTO "scopes" ("member_id", "given_by", "scope", "target", "access_level")
SELECT DISTINCT ON (old."member_id") old."member_id", old."given_by", 'website'::"scope_type", 'content'::"target_type", 'edit'::"access_level_type"
FROM "scopes" old
WHERE old."scope" = 'website' AND old."target" <> 'content' AND old."member_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "scopes" held WHERE held."member_id" = old."member_id" AND held."scope" = 'website' AND held."target" = 'content'
  )
ORDER BY old."member_id", old."id";
