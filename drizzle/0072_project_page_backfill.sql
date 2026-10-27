-- Every project version holds its page blocks record (issue #535), the first
-- of two steps that make `page` the only stored record of a project.
--
-- Migration 0050 (issue #525) filled `page` from `content` and left `content`
-- in place, so code built before page blocks could still run; that code saved
-- by deleting and inserting rows, so a version it wrote after 0050 has no
-- `page`. This fills `page` on every such row by 0050's own statement, run
-- again unchanged: the same mapping, the retired `teaser` key left out, and a
-- row that already has a `page` left as it is. Then `page` is required, and
-- checked to be a record as `content` was.
--
-- The next migration, 0073_drop_project_content, drops `content`; it runs
-- after this one, so no row loses its record. The UPDATE below is the only
-- statement here that changes a stored row (lib/seed/additive-migration.test.ts).
UPDATE "project_versions" SET "page" = (
  "content" - 'texture' - 'teaser' - 'nameStory' - 'design' - 'versions' - 'launches' - 'plan' - 'reasons' - 'gallery'
) || jsonb_build_object(
  'background', jsonb_build_object('kind', 'texture', 'src', "content"->'texture'),
  'card', ("content"->'card') - 'rocket',
  'hero', (("content"->'hero') - 'visual') || jsonb_build_object('visual', CASE
    WHEN "content" #> '{hero,visual,rocket}' IS NULL THEN '{"kind":"none"}'::jsonb
    ELSE jsonb_build_object('kind', 'model', 'caption', "content" #> '{hero,visual,caption}')
      || CASE WHEN "content" #> '{hero,visual,rocket,own}' IS NULL THEN '{}'::jsonb
        ELSE jsonb_build_object('own', "content" #> '{hero,visual,rocket,own}') END
  END),
  'blocks', (
    SELECT coalesce(jsonb_agg("block" ORDER BY "place"), '[]'::jsonb)
    FROM (
      SELECT "place", "block"
      FROM (
        -- Every launch's second photo, in launch order: null when none has one.
        SELECT jsonb_agg("launch" #> '{photos,1}' ORDER BY "at") AS "photos"
        FROM jsonb_array_elements(coalesce("content" #> '{launches,entries}', '[]'::jsonb)) WITH ORDINALITY AS "entry" ("launch", "at")
        WHERE "launch" #> '{photos,1}' IS NOT NULL
      ) AS "seconds"
      CROSS JOIN LATERAL (VALUES
        (1, jsonb_build_object('id', 'name', 'kind', 'text', 'hidden', false, 'width', 'half',
          'heading', jsonb_build_object('label', 'THE NAME', 'title', "content" #> '{nameStory,title}'),
          'body', "content" #> '{nameStory,body}')),
        (2, jsonb_build_object('id', 'design', 'kind', 'text', 'hidden', false, 'width', 'half',
          'heading', jsonb_build_object('label', 'THE DESIGN', 'title', "content" #> '{design,title}'),
          'body', "content" #> '{design,body}', 'parts', "content" #> '{design,parts}')),
        (3, CASE WHEN "content" ? 'versions' THEN
          jsonb_build_object('id', 'versions', 'kind', 'versions', 'hidden', false) || ("content"->'versions') END),
        (4, CASE WHEN "content" ? 'launches' THEN
          jsonb_build_object('id', 'launches', 'kind', 'launches', 'hidden', false,
            'title', "content" #> '{launches,title}',
            'entries', (
              SELECT jsonb_agg(("launch" - 'photos')
                || CASE WHEN "launch" #> '{photos,0}' IS NULL THEN '{}'::jsonb
                  ELSE jsonb_build_object('cover', "launch" #> '{photos,0}') END
                ORDER BY "at")
              FROM jsonb_array_elements("content" #> '{launches,entries}') WITH ORDINALITY AS "entry" ("launch", "at")
            )) END),
        (5, CASE WHEN "content" ? 'plan' THEN
          jsonb_build_object('id', 'plan', 'kind', 'timeline', 'hidden', false) || ("content"->'plan') END),
        (6, CASE WHEN "content" ? 'reasons' THEN
          jsonb_build_object('id', 'reasons', 'kind', 'points', 'hidden', false) || ("content"->'reasons') END),
        (7, CASE
          WHEN "content" ? 'gallery' THEN
            jsonb_build_object('id', 'gallery', 'kind', 'gallery', 'hidden', false) || ("content"->'gallery')
              || jsonb_build_object('items', ("content" #> '{gallery,items}') || coalesce("seconds"."photos", '[]'::jsonb))
          WHEN "seconds"."photos" IS NOT NULL THEN
            jsonb_build_object('id', 'gallery', 'kind', 'gallery', 'hidden', false, 'title', 'Launch photos.', 'items', "seconds"."photos")
        END)
      ) AS "candidate" ("place", "block")
      WHERE "block" IS NOT NULL
    ) AS "blocks"
  )
)
WHERE "page" IS NULL;
--> statement-breakpoint
ALTER TABLE "project_versions" ALTER COLUMN "page" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_versions_page_is_record') THEN ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_page_is_record" CHECK (jsonb_typeof("page") = 'object'); END IF; END $$;
