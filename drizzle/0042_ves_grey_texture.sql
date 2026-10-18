-- VES's rocket is orange, so its card, its /projects panel and its page sit
-- on a grey version of its streak texture instead of the orange one (issue
-- #386). Every stored version of VES (published and draft) gets the new
-- texture. Written by `revisionSql(vesGreyTexture)`
-- (lib/project-content/revision.ts, import.ts);
-- lib/project-content/content.test.ts checks this file holds exactly its
-- output.
UPDATE "project_versions" SET "content" = jsonb_set("content", '{texture}', '"/textures/project-ves-grey.webp"'::jsonb, true) WHERE "content"->>'slug' = 'ves';
