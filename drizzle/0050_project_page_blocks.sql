-- Project page blocks (epic #522, issue #525). Every stored project version,
-- published and draft, trades its fixed sections for one ordered list of page
-- blocks, in today's page order: the name story and the design story become
-- two half-width text blocks, then the versions, the launch history, the plan
-- (a timeline), the reasons (numbered points) and the gallery, each shown and
-- with the section's name as its id. Each launch keeps its first photo as its
-- cover, and every second photo is appended to the gallery at the end of the
-- page, which is created there when the project had none (grill #524, R1.2).
-- The brand texture becomes the background, kept as it is, and the page
-- panel's model becomes the top visual, which the card draws too, so each
-- project keeps its texture and its model (R1.1). The retired `teaser` key
-- goes. A version that already has blocks is left as it is.
-- `blocksRecordOf` (lib/project-content/legacy.ts) is this statement in code;
-- lib/project-content/blocks-migration.test.ts runs this file on the stored
-- projects and checks both give the same records.
UPDATE "project_versions" SET "content" = (
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
WHERE NOT ("content" ? 'blocks');
